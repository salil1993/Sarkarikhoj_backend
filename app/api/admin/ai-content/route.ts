import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/db/client";
import { generateSchemeContent } from "@/services/aiContentService";
import { invalidateSchemeCache } from "@/services/eligibilityScoreEngine";
import { requireAdminSecret } from "@/utils/adminAuth";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError } from "@/utils/errors";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  slug: z.string().min(1).max(255),
});

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`admin-ai:${id}`);
    if (!limited.success) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMITED", message: "Too many requests." } },
        { status: 429, headers: mergeHeaders(undefined, cors) },
      );
    }

    requireAdminSecret(request);

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("admin-ai", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const scheme = await prisma.scheme.findUnique({ where: { slug: parsed.data.slug.trim() } });
    if (!scheme) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Scheme not found." } },
        { status: 404, headers: mergeHeaders(undefined, cors) },
      );
    }

    const bundle = await generateSchemeContent({
      schemeName: scheme.scheme_name,
      existingDescription: scheme.description,
      benefitText: scheme.benefit,
    });

    if (!bundle) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "AI_UNAVAILABLE",
            message: "Set GROQ_API_KEY or OPENAI_API_KEY to enable generation.",
          },
        },
        { status: 503, headers: mergeHeaders(undefined, cors) },
      );
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
    } as unknown as Prisma.SchemeUncheckedUpdateInput;

    type SchemeFaqDelegate = {
      deleteMany: (args: {
        where: { schemeId: number };
      }) => Prisma.PrismaPromise<Prisma.BatchPayload>;
      createMany: (args: {
        data: typeof faqRows;
      }) => Prisma.PrismaPromise<Prisma.BatchPayload>;
    };
    const faq = (prisma as unknown as { schemeFaq: SchemeFaqDelegate }).schemeFaq;

    const steps: Prisma.PrismaPromise<unknown>[] = [
      prisma.scheme.update({
        where: { id: scheme.id },
        data: updateData,
      }),
      faq.deleteMany({ where: { schemeId: scheme.id } }),
    ];
    if (faqRows.length > 0) {
      steps.push(faq.createMany({ data: faqRows }));
    }
    await prisma.$transaction(steps);

    void invalidateSchemeCache();

    return NextResponse.json(
      { ok: true, data: { slug: scheme.slug, generated: true, faqsStored: faqRows.length } },
      { status: 200, headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "admin-ai");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
