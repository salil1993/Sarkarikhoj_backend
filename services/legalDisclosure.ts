import type { LegalDisclosure } from "@/types/legal";

export const LEGAL_DISCLOSURE: LegalDisclosure = {
  disclaimer:
    "SarkariKhojKhabar provides general information only. We are not a government body, do not issue official approvals, and do not guarantee eligibility for any scheme. Always confirm requirements, documents, and deadlines on the official portal before you apply.",
  official_sources_notice:
    "Every scheme response includes an official_url pointing to a government or authorised source. Use that link as the authoritative reference.",
  eligibility_notice:
    "Scores and matched criteria are informational estimates based on the data you provide and our rules engine. They are not a promise of benefits, approval, or entitlement.",
};

export function legalEnvelope<T extends Record<string, unknown>>(body: T): T & { legal: LegalDisclosure } {
  return { ...body, legal: LEGAL_DISCLOSURE };
}
