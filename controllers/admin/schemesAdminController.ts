import {
  createAdminScheme,
  deleteAdminScheme,
  getAdminSchemeById,
  listAdminSchemes,
  updateAdminScheme,
} from "@/services/adminSchemesService";
import type { SchemeCreateInput, SchemeUpdateInput } from "@/utils/adminSchemas";

export const schemesAdmin = {
  list: (page: number, limit: number) => listAdminSchemes(page, limit),
  getById: (id: number) => getAdminSchemeById(id),
  create: (data: SchemeCreateInput) => createAdminScheme(data),
  update: (id: number, data: SchemeUpdateInput) => updateAdminScheme(id, data),
  delete: (id: number) => deleteAdminScheme(id),
};
