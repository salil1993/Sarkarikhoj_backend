const TAG_RE = /<[^>]*>/g;

/**
 * Trim, collapse whitespace, and strip angle-bracket tags from user-controlled strings.
 */
export function sanitizeText(input: string, maxLength: number): string {
  const stripped = input.replace(TAG_RE, " ");
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  return collapsed.slice(0, maxLength);
}

export function sanitizeOptionalText(
  input: string | undefined,
  maxLength: number,
): string | undefined {
  if (input === undefined || input === null) return undefined;
  const s = sanitizeText(String(input), maxLength);
  return s.length === 0 ? undefined : s;
}
