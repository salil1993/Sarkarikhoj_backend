import { z } from "zod";
import { sanitizeOptionalText, sanitizeText } from "@/utils/sanitize";
import type { NormalizedEligibilityInput } from "@/types/eligibility";

const eligibilitySchema = z.object({
  age: z.coerce
    .number({ invalid_type_error: "age must be a number" })
    .int("age must be an integer")
    .min(0, "age must be at least 0")
    .max(120, "age must be at most 120"),
  gender: z
    .string({ required_error: "gender is required" })
    .min(1, "gender is required")
    .max(32),
  state: z
    .string({ required_error: "state is required" })
    .min(1, "state is required")
    .max(128),
  income: z.coerce
    .number({ invalid_type_error: "income must be a number" })
    .min(0, "income must be non-negative")
    .max(1_000_000_000_000, "income is too large"),
  occupation: z
    .string({ required_error: "occupation is required" })
    .min(1, "occupation is required")
    .max(128),
  category: z.string().max(64).optional(),
});

export type EligibilityParsed = z.infer<typeof eligibilitySchema>;

export function parseEligibilityBody(
  body: unknown,
): { success: true; data: NormalizedEligibilityInput } | { success: false; error: z.ZodError } {
  const parsed = eligibilitySchema.safeParse(body);
  if (!parsed.success) return { success: false, error: parsed.error };

  const d = parsed.data;
  const gender = sanitizeText(d.gender, 32).toLowerCase();
  const state = sanitizeText(d.state, 128).toLowerCase();
  const occupation = sanitizeText(d.occupation, 128).toLowerCase();
  const category = sanitizeOptionalText(d.category, 64);

  return {
    success: true,
    data: {
      age: d.age,
      gender,
      state,
      income: d.income,
      occupation,
      category,
    },
  };
}

const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "invalid slug format");

export function parseSlugParam(slug: string | string[] | undefined) {
  const raw = Array.isArray(slug) ? slug[0] : slug;
  return slugSchema.safeParse(raw ?? "");
}
