import {
  createAdminBlog,
  deleteAdminBlog,
  getAdminBlogById,
  listAdminBlogs,
  updateAdminBlog,
} from "@/services/adminBlogsService";
import type { BlogCreateInput, BlogUpdateInput } from "@/utils/adminSchemas";

export const blogsAdmin = {
  list: (page: number, limit: number) => listAdminBlogs(page, limit),
  getById: (id: number) => getAdminBlogById(id),
  create: (data: BlogCreateInput) => createAdminBlog(data),
  update: (id: number, data: BlogUpdateInput) => updateAdminBlog(id, data),
  delete: (id: number) => deleteAdminBlog(id),
};
