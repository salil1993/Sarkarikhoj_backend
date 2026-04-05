import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/db/client";
import { adminDb } from "@/services/adminPrismaAccess";
import { generateBlogPost, generateSchemeContent, slugifyBlogSlug } from "@/services/aiContentService";
import { invalidateSchemeCache } from "@/services/eligibilityScoreEngine";
import { requireAdminSecret } from "@/utils/adminAuth";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z
  .object({
    target: z.enum(["scheme", "blog"]).default("scheme"),
    slug: z.string().min(1).max(255).optional(),
    topic: z.string().min(10).max(4000).optional(),
    focusKeyword: z.string().max(128).optional(),
    blogSlug: z.string().min(1).max(255).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.target === "scheme") {
      if (!val.slug?.trim()) {
        ctx.addIssue({ code: "custom", message: "slug is required for scheme target", path: ["slug"] });
      }
    } else {
      if (!val.topic?.trim()) {
        ctx.addIssue({ code: "custom", message: "topic is required for blog target", path: ["topic"] });
      }
    }
  });

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`admin-ai:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    requireAdminSecret(request);

    const body = await request.json().catch(() => null);
    const raw = body && typeof body === "object" && !("target" in body) && "slug" in body
      ? { ...(body as object), target: "scheme" as const }
      : body;
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      logValidationFailure("admin-ai", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const p = parsed.data;
    const adb = adminDb();

    if (p.target === "blog") {
      const bundle = await generateBlogPost({
        topic: p.topic!.trim(),
        focusKeyword: p.focusKeyword?.trim(),
      });
      if (!bundle) {
        const res = jsonError(
          503,
          "AI_UNAVAILABLE",
          "Set GROQ_API_KEY or OPENAI_API_KEY to enable generation.",
        );
        return new NextResponse(res.body, {
          status: res.status,
          headers: mergeHeaders(res.headers, cors),
        });
      }

      let slug = p.blogSlug?.trim() || slugifyBlogSlug(bundle.title);
      if (p.blogSlug?.trim()) {
        const taken = await adb.seoBlogPost.findUnique({ where: { slug } });
        if (taken) {
          const res = jsonError(409, "SLUG_TAKEN", "blogSlug already exists", {
            fields: [{ field: "blogSlug", error: "taken" }],
          });
          return new NextResponse(res.body, {
            status: res.status,
            headers: mergeHeaders(res.headers, cors),
          });
        }
      } else {
        for (let i = 0; i < 8; i++) {
          const clash = await adb.seoBlogPost.findUnique({ where: { slug } });
          if (!clash) break;
          slug = slugifyBlogSlug(`${bundle.title}-${i + 1}`);
        }
      }

      await adb.seoBlogPost.create({
        data: {
          slug,
          title: bundle.title,
          excerpt: bundle.excerpt,
          body: bundle.body,
          faqs: bundle.faqs as unknown as Prisma.InputJsonValue,
          focusKeyword: bundle.focusKeyword ?? p.focusKeyword?.trim(),
          published: false,
        },
      });

      return jsonPublicOk(
        { target: "blog", slug, title: bundle.title, faqsCount: bundle.faqs.length },
        { headers: mergeHeaders(undefined, cors) },
      );
    }

    const scheme = await prisma.scheme.findUnique({ where: { slug: p.slug!.trim() } });
    if (!scheme) {
      const res = jsonError(404, "NOT_FOUND", "Scheme not found.");
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const bundle = await generateSchemeContent({
      schemeName: scheme.scheme_name,
      existingDescription: scheme.description,
      benefitText: scheme.benefit,
    });

    if (!bundle) {
      const res = jsonError(
        503,
        "AI_UNAVAILABLE",
        "Set GROQ_API_KEY or OPENAI_API_KEY to enable generation.",
      );
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const faqRows = bundle.faqs
      .map((f) => ({
        q: typeof f?.q === "string" ? f.q.trim() : "",
        a: typeof f?.a === "string" ? f.a.trim() : "",
      }))
      .filter((f) => f.q.length > 0 && f.a.length > 0)
      .map((f, i) => ({
        schemeId: scheme.id,
        question: f.q,
        answer: f.a,
        sort: i,
      }));

    const updateData = {
      ai_description: bundle.description,
      ai_benefits_summary: bundle.benefitsSummary,
      ai_faqs: bundle.faqs as unknown as Prisma.InputJsonValue,
    } as Prisma.SchemeUncheckedUpdateInput;

    const steps: Prisma.PrismaPromise<unknown>[] = [
      prisma.scheme.update({
        where: { id: scheme.id },
        data: updateData,
      }),
      adb.schemeFaq.deleteMany({ where: { schemeId: scheme.id } }),
    ];
    if (faqRows.length > 0) {
      steps.push(adb.schemeFaq.createMany({ data: faqRows }));
    }
    await prisma.$transaction(steps);

    void invalidateSchemeCache();

    return jsonPublicOk(
      {
        target: "scheme",
        slug: scheme.slug,
        generated: true,
        faqsStored: faqRows.length,
        official_url: scheme.apply_link,
      },
      { headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "admin-ai");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
