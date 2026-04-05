import { HttpError } from "@/utils/errors";

export function requireAdminSecret(request: Request) {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    throw new HttpError(503, "ADMIN_DISABLED", "Admin operations are not configured.");
  }
  const provided = request.headers.get("x-admin-secret")?.trim();
  if (provided !== secret) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid admin credentials.");
  }
}
