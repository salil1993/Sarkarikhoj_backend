/**
 * Lightweight HTML probe for government portal pages (no JS rendering).
 * Use extracted links for manual review or downstream CSV pipeline.
 */
export async function probePortalUrl(url: string): Promise<{
  ok: boolean;
  status: number;
  title?: string;
  sampleLinks: string[];
}> {
  const res = await fetch(url, {
    headers: { "User-Agent": "SarkariKhojKhabar-Ingest/1.0 (+https://sarkarikhojkhabar.com)" },
    redirect: "follow",
  });
  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((h) => h.startsWith("http") || h.startsWith("/"))
    .slice(0, 40);
  return { ok: res.ok, status: res.status, title, sampleLinks: hrefs };
}
