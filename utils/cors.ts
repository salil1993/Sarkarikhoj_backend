/** Prefer CORS_ORIGIN (Vercel); CORS_ORIGINS kept for backward compatibility. */
function rawOriginsFromEnv(): string | undefined {
  const a = process.env.CORS_ORIGIN?.trim();
  const b = process.env.CORS_ORIGINS?.trim();
  return a || b || undefined;
}

export function parseAllowedOrigins(): Set<string> | null {
  const raw = rawOriginsFromEnv();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );
}

export function corsHeaders(request: { headers: Headers }): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = parseAllowedOrigins();
  if (!origin || !allowed || allowed.size === 0) {
    return {};
  }
  if (!allowed.has(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
