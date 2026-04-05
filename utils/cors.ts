/** Prefer CORS_ORIGIN; CORS_ORIGINS kept for backward compatibility. */
function rawOriginsFromEnv(): string | undefined {
  const a = process.env.CORS_ORIGIN?.trim();
  const b = process.env.CORS_ORIGINS?.trim();
  return a || b || undefined;
}

/**
 * Canonical form for comparison: trim, no trailing slash, scheme+host only (no path).
 * Browsers send Origin without path; env entries may accidentally include a trailing `/`.
 */
export function normalizeOrigin(origin: string): string {
  const t = origin.trim();
  if (!t) return t;
  try {
    const u = new URL(t);
    return `${u.protocol}//${u.host}`;
  } catch {
    return t.replace(/\/+$/, "");
  }
}

/**
 * Comma-separated origins from env; trimmed; normalized; duplicates removed.
 * Returns null if unset or empty → no CORS headers (same-origin only).
 */
export function parseAllowedOrigins(): Set<string> | null {
  const raw = rawOriginsFromEnv();
  if (!raw) return null;
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const n = normalizeOrigin(part);
    if (n) set.add(n);
  }
  return set.size > 0 ? set : null;
}

const ALLOW_METHODS = "GET, POST, PATCH, OPTIONS";
const ALLOW_HEADERS =
  "Content-Type, Authorization, X-User-Id, X-Admin-Secret, X-Requested-With";

export function corsHeaders(request: { headers: Headers }): Record<string, string> {
  const allowed = parseAllowedOrigins();
  const originHeader = request.headers.get("origin");
  if (!originHeader || !allowed || allowed.size === 0) {
    return {};
  }

  const key = normalizeOrigin(originHeader);
  if (!key || !allowed.has(key)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": originHeader.trim(),
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function mergeHeaders(
  base: HeadersInit | undefined,
  extra: Record<string, string>,
): Headers {
  const h = new Headers(base ?? undefined);
  for (const [k, v] of Object.entries(extra)) {
    if (v) h.set(k, v);
  }
  return h;
}
