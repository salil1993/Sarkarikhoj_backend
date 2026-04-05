import { LEGAL_DISCLOSURE } from "@/services/legalDisclosure";
import type { LegalDisclosure } from "@/types/legal";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";

/** Keys stored in `site_settings`; values are JSON objects `{ "text": string }` or structured blobs. */
export const SITE_SETTING_KEYS = {
  LEGAL_DISCLAIMER: "legal.disclaimer",
  LEGAL_OFFICIAL_SOURCES: "legal.official_sources_notice",
  LEGAL_ELIGIBILITY: "legal.eligibility_notice",
  UI_OFFICIAL_LINK_LABEL: "ui.official_apply_link_label",
  UI_INDICATIVE_LABEL: "ui.indicative_eligibility_label",
  COMPLIANCE_FOOTER: "compliance.footer_notice",
} as const;

function jsonText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in value && typeof (value as { text: unknown }).text === "string") {
    return (value as { text: string }).text;
  }
  return undefined;
}

/**
 * Merged legal copy for public clients (admin-editable overrides on top of code defaults).
 */
export async function getPublicLegalAndUiSettings(): Promise<{
  legal: LegalDisclosure;
  ui: { officialApplyLinkLabel: string; indicativeEligibilityLabel: string };
  complianceFooter?: string;
}> {
  const keys = [
    SITE_SETTING_KEYS.LEGAL_DISCLAIMER,
    SITE_SETTING_KEYS.LEGAL_OFFICIAL_SOURCES,
    SITE_SETTING_KEYS.LEGAL_ELIGIBILITY,
    SITE_SETTING_KEYS.UI_OFFICIAL_LINK_LABEL,
    SITE_SETTING_KEYS.UI_INDICATIVE_LABEL,
    SITE_SETTING_KEYS.COMPLIANCE_FOOTER,
  ];
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const legal: LegalDisclosure = {
    disclaimer: jsonText(map.get(SITE_SETTING_KEYS.LEGAL_DISCLAIMER)) ?? LEGAL_DISCLOSURE.disclaimer,
    official_sources_notice:
      jsonText(map.get(SITE_SETTING_KEYS.LEGAL_OFFICIAL_SOURCES)) ??
      LEGAL_DISCLOSURE.official_sources_notice,
    eligibility_notice:
      jsonText(map.get(SITE_SETTING_KEYS.LEGAL_ELIGIBILITY)) ?? LEGAL_DISCLOSURE.eligibility_notice,
  };

  const ui = {
    officialApplyLinkLabel:
      jsonText(map.get(SITE_SETTING_KEYS.UI_OFFICIAL_LINK_LABEL)) ?? "Official application link (external)",
    indicativeEligibilityLabel:
      jsonText(map.get(SITE_SETTING_KEYS.UI_INDICATIVE_LABEL)) ??
      "Indicative match only — not government approval",
  };

  const complianceFooter = jsonText(map.get(SITE_SETTING_KEYS.COMPLIANCE_FOOTER));

  return { legal, ui, ...(complianceFooter ? { complianceFooter } : {}) };
}

export async function listAllSiteSettings(): Promise<Array<{ key: string; value: unknown; updatedAt: string }>> {
  const rows = await prisma.siteSetting.findMany({ orderBy: { key: "asc" } });
  return rows.map((r) => ({
    key: r.key,
    value: r.value,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function upsertSiteSettings(
  entries: Array<{ key: string; value?: unknown }>,
): Promise<number> {
  let n = 0;
  for (const e of entries) {
    const key = e.key.trim().slice(0, 128);
    if (!key || key.startsWith("secret.") || e.value === undefined) continue;
    const value = e.value as Prisma.InputJsonValue;
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    n += 1;
  }
  return n;
}
