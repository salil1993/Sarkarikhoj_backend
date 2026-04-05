import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const adminSlugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(slugRegex, "invalid slug format (lowercase letters, numbers, hyphens)");

const benefitRowSchema = z.object({
  title: z.string().max(256).optional().nullable(),
  body: z.string().min(1).max(50_000),
  sort: z.number().int().optional(),
});

const documentRowSchema = z.object({
  name: z.string().min(1).max(512),
  sort: z.number().int().optional(),
});

const eligibilityRuleRowSchema = z.object({
  criterion: z.string().min(1).max(64),
  operator: z.string().min(1).max(16),
  value: z.string().min(1).max(10_000),
  weight: z.number().int().min(0).max(1000).optional(),
});

const schemeFieldsSchema = z.object({
  scheme_name: z.string().min(1).max(512),
  slug: adminSlugSchema,
  description: z.string().min(1).max(100_000),
  min_age: z.number().int().min(0).max(120).nullable().optional(),
  max_age: z.number().int().min(0).max(120).nullable().optional(),
  income_limit: z.number().int().min(0).nullable().optional(),
  gender: z.string().max(32).nullable().optional(),
  occupation: z.string().max(128).nullable().optional(),
  state: z.string().max(128).nullable().optional(),
  district: z.string().max(128).nullable().optional(),
  category: z.string().max(64).nullable().optional(),
  benefit: z.string().min(1).max(100_000).optional(),
  documents_required: z.string().max(100_000).optional(),
  apply_link: z.string().min(1).max(2048).url(),
  eligibility_rules_json: z.unknown().optional(),
  benefits: z.array(benefitRowSchema).max(200).optional(),
  documents: z.array(documentRowSchema).max(200).optional(),
  eligibilityRules: z.array(eligibilityRuleRowSchema).max(200).optional(),
  tagSlugs: z.array(z.string().min(1).max(64)).max(50).optional(),
});

export const schemeCreateSchema = schemeFieldsSchema.refine(
  (d) => Boolean((d.benefit && d.benefit.trim().length > 0) || (d.benefits && d.benefits.length > 0)),
  { path: ["benefit"], message: "Provide benefit (text) or at least one entry in benefits[]" },
);

export const schemeUpdateSchema = schemeFieldsSchema.partial();

export type SchemeCreateInput = z.infer<typeof schemeCreateSchema>;
export type SchemeUpdateInput = z.infer<typeof schemeUpdateSchema>;

export const blogCreateSchema = z.object({
  slug: adminSlugSchema,
  title: z.string().min(1).max(512),
  excerpt: z.string().max(20_000).nullable().optional(),
  body: z.string().min(1).max(500_000),
  faqs: z.unknown().optional(),
  focusKeyword: z.string().max(128).nullable().optional(),
  published: z.boolean().optional(),
});

export const blogUpdateSchema = blogCreateSchema.partial();

export type BlogCreateInput = z.infer<typeof blogCreateSchema>;
export type BlogUpdateInput = z.infer<typeof blogUpdateSchema>;

export const seoGenerateSchema = z.object({
  pages: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("category"), slug: z.string().min(1).max(128) }),
        z.object({
          kind: z.literal("location"),
          state: z.string().min(1).max(128),
          district: z.string().max(128).optional(),
        }),
        z.object({ kind: z.literal("income"), max_income: z.number().int().min(0) }),
      ]),
    )
    .min(1)
    .max(100),
  published: z.boolean().optional(),
});

export type SeoGenerateInput = z.infer<typeof seoGenerateSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
