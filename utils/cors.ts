function parseOrigins(): Set<string> | null {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = parseOrigins();
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
