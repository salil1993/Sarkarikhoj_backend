import { paginationQuerySchema } from "@/utils/adminSchemas";

export function parsePaginationFromUrl(url: string) {
  const { searchParams } = new URL(url);
  const raw = Object.fromEntries(searchParams.entries());
  return paginationQuerySchema.safeParse({
    page: raw.page ?? "1",
    limit: raw.limit ?? "50",
  });
}
