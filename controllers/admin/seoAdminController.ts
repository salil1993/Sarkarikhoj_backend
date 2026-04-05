import { generateAndStoreSeoPages } from "@/services/adminSeoGenerateService";
import type { SeoGenerateInput } from "@/utils/adminSchemas";

export const seoAdmin = {
  generatePages: (input: SeoGenerateInput) => generateAndStoreSeoPages(input),
};
