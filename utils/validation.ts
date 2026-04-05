import { z } from "zod";
import { sanitizeOptionalText, sanitizeText } from "@/utils/sanitize";
import type { NormalizedEligibilityInput } from "@/types/eligibility";

/** Maps common frontend / alternate JSON keys to canonical names (does not log values). */
function normalizeEligibilityPayload(body: unknown): unknown {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  const src = body as Record<string, unknown>;
  const nested =
    src.data !== undefined && typeof src.data === "object" && !Array.isArray(src.data)
      ? { ...(src.data as Record<string, unknown>) }
      : {};
  const out: Record<string, unknown> = { ...nested, ...src };
  delete out.data;

  const alias = (canonical: string, keys: string[]) => {
    if (out[canonical] !== undefined && out[canonical] !== null) return;
    for (const key of keys) {
      if (key in out && out[key] !== undefined && out[key] !== null) {
        out[canonical] = out[key];
        return;
      }
    }
  };

  alias("income", [
    "annualIncome",
    "annual_income",
    "yearlyIncome",
    "yearly_income",
    "salary",
    "incomePerAnnum",
    "income_per_annum",
  ]);
  alias("state", [
    "stateUT",
    "state_ut",
    "stateName",
    "state_name",
    "region",
    "province",
    "ut",
  ]);
  alias("age", ["ageYears", "age_years", "userAge", "user_age"]);
  alias("gender", ["sex"]);
  alias("occupation", ["job", "work", "profession", "occupationType", "occupation_type"]);
  alias("category", ["caste", "reservationCategory", "reservation_category", "socialCategory"]);

  return out;
}

function trimToString(v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  return String(v).trim();
}

function coerceFiniteNumber() {
  return (v: unknown): unknown => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return undefined;
      const n = Number(t);
      return Number.isFinite(n) ? n : NaN;
    }
    return NaN;
  };
}

const eligibilitySchema = z.object({
  age: z.preprocess(
    coerceFiniteNumber(),
    z
      .number({ required_error: "age is required", invalid_type_error: "age must be a number" })
      .int("age must be an integer")
      .min(0, "age must be at least 0")
      .max(120, "age must be at most 120"),
  ),
  gender: z.preprocess(
    trimToString,
    z
      .string({ required_error: "gender is required" })
      .min(1, "gender is required")
      .max(32),
  ),
  state: z.preprocess(
    trimToString,
    z
      .string({ required_error: "state is required" })
      .min(1, "state is required")
      .max(128),
  ),
  income: z.preprocess(
    coerceFiniteNumber(),
    z
      .number({
        required_error: "income is required",
        invalid_type_error: "income must be a number",
      })
      .min(0, "income must be non-negative")
      .max(1_000_000_000_000, "income is too large"),
  ),
  occupation: z.preprocess(
    trimToString,
    z
      .string({ required_error: "occupation is required" })
      .min(1, "occupation is required")
      .max(128),
  ),
  category: z.preprocess((v) => {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    return s === "" ? undefined : s;
  }, z.string().max(64).optional()),
});

export type EligibilityParsed = z.infer<typeof eligibilitySchema>;

export type ValidationErrorDetails = {
  message: string;
  fieldErrors: Record<string, string[] | undefined>;
  formErrors: string[];
  issues: Array<{ path: string[]; message: string; code: string }>;
};

export function formatValidationErrorDetails(error: z.ZodError): ValidationErrorDetails {
  const flat = error.flatten();
  return {
    message: "One or more fields are invalid. See fieldErrors and issues.",
    fieldErrors: flat.fieldErrors,
    formErrors: flat.formErrors,
    issues: error.issues.map((i) => ({
      path: i.path.map(String),
      message: i.message,
      code: i.code,
    })),
  };
}

/** Logs paths and issue codes only (no user-submitted values). */
export function logValidationFailure(routeKey: string, error: z.ZodError) {
  const summary = error.issues.map((i) => ({
    path: i.path.length ? i.path.join(".") : "(root)",
    code: i.code,
  }));
  console.error(`[api] ${routeKey} validation failed`, {
    issueCount: error.issues.length,
    summary,
  });
}

export function parseEligibilityBody(
  body: unknown,
):
  | { success: true; data: NormalizedEligibilityInput }
  | { success: false; error: z.ZodError } {
  const normalized = normalizeEligibilityPayload(body);
  const parsed = eligibilitySchema.safeParse(normalized);
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
