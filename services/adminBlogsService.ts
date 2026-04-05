import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import type { BlogCreateInput, BlogUpdateInput } from "@/utils/adminSchemas";

function toDto(row: {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  faqs: Prisma.JsonValue | null;
  focusKeyword: string | null;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    faqs: row.faqs,
    focusKeyword: row.focusKeyword,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAdminBlogs(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    prisma.seoBlogPost.count(),
    prisma.seoBlogPost.findMany({
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return { blogs: rows.map(toDto), total, page, limit };
}

export async function getAdminBlogById(id: number) {
  const row = await prisma.seoBlogPost.findUnique({ where: { id } });
  if (!row) return null;
  return toDto(row);
}

export async function createAdminBlog(data: BlogCreateInput) {
  const row = await prisma.seoBlogPost.create({
    data: {
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt ?? null,
      body: data.body,
      faqs: data.faqs === undefined ? undefined : (data.faqs as Prisma.InputJsonValue),
      focusKeyword: data.focusKeyword ?? null,
      published: data.published ?? false,
    },
  });
  return toDto(row);
}

export async function updateAdminBlog(id: number, data: BlogUpdateInput) {
  const exists = await prisma.seoBlogPost.findUnique({ where: { id } });
  if (!exists) return null;
  const row = await prisma.seoBlogPost.update({
    where: { id },
    data: {
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.faqs !== undefined ? { faqs: data.faqs as Prisma.InputJsonValue } : {}),
      ...(data.focusKeyword !== undefined ? { focusKeyword: data.focusKeyword } : {}),
      ...(data.published !== undefined ? { published: data.published } : {}),
    },
  });
  return toDto(row);
}

export async function deleteAdminBlog(id: number) {
  const r = await prisma.seoBlogPost.deleteMany({ where: { id } });
  return r.count > 0;
}
