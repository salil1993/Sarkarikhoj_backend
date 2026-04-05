/** Attached to public API JSON so clients always show legal copy + official links. */
export type LegalDisclosure = {
  disclaimer: string;
  official_sources_notice: string;
  eligibility_notice: string;
};

export type WithLegal<T> = T & { legal: LegalDisclosure };
