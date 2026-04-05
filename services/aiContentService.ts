/**
 * Optional LLM enrichment via Groq (OpenAI-compatible) or OpenAI.
 * Set GROQ_API_KEY or OPENAI_API_KEY + OPENAI_BASE_URL (optional).
 */

type FaqItem = { q: string; a: string };

export type AiGeneratedBundle = {
  description: string;
  benefitsSummary: string;
  faqs: FaqItem[];
};

function pickClient() {
  const groq = process.env.GROQ_API_KEY?.trim();
  if (groq) {
    return {
      apiKey: groq,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
    };
  }
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      apiKey: openai,
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }
  return null;
}

export async function generateSchemeContent(params: {
  schemeName: string;
  existingDescription: string;
  benefitText: string;
}): Promise<AiGeneratedBundle | null> {
  const client = pickClient();
  if (!client) return null;

  const system =
    "You are an assistant for Indian government welfare schemes. Output ONLY valid JSON with keys: description (string, 2-4 sentences, factual tone), benefitsSummary (string, bullet-style plain text), faqs (array of {q,a} with 3 items). No markdown fences.";

  const user = `Scheme: ${params.schemeName}\nKnown description:\n${params.existingDescription}\nBenefits:\n${params.benefitText}`;

  const res = await fetch(`${client.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: client.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    console.error("[ai] completion http error", res.status);
    return null;
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return null;

  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned) as AiGeneratedBundle;
    if (!parsed.description || !parsed.benefitsSummary || !Array.isArray(parsed.faqs)) {
      return null;
    }
    return parsed;
  } catch {
    console.error("[ai] json parse failed");
    return null;
  }
}

export type AiBlogBundle = {
  title: string;
  excerpt: string;
  body: string;
  faqs: FaqItem[];
  focusKeyword?: string;
};

export async function generateBlogPost(params: {
  topic: string;
  focusKeyword?: string;
}): Promise<AiBlogBundle | null> {
  const client = pickClient();
  if (!client) return null;

  const system =
    "You write SEO-friendly, factual articles about Indian government welfare schemes. Output ONLY valid JSON with keys: title (string, <=70 chars), excerpt (string, 1-2 sentences), body (string, 4-8 short paragraphs in plain text, no HTML), faqs (array of 4-6 {q,a}). You MUST include one short paragraph that states information is not official legal advice and users must verify on government websites. Never claim guaranteed eligibility or official approval.";

  const user = `Blog topic: ${params.topic}\nFocus keyword (optional): ${params.focusKeyword ?? "none"}`;

  const res = await fetch(`${client.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: client.model,
      temperature: 0.35,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    console.error("[ai] blog completion http error", res.status);
    return null;
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return null;

  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned) as AiBlogBundle;
    if (!parsed.title || !parsed.excerpt || !parsed.body || !Array.isArray(parsed.faqs)) {
      return null;
    }
    if (params.focusKeyword?.trim()) parsed.focusKeyword = params.focusKeyword.trim();
    return parsed;
  } catch {
    console.error("[ai] blog json parse failed");
    return null;
  }
}

export function slugifyBlogSlug(base: string): string {
  const s = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return s ? `${s}-${Date.now().toString(36)}` : `post-${Date.now().toString(36)}`;
}
