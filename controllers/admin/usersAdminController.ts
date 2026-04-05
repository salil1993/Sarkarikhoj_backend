import { getAdminUserById, listAdminUsers } from "@/services/adminUsersService";

export const usersAdmin = {
  list: (page: number, limit: number) => listAdminUsers(page, limit),
  getById: (id: number) => getAdminUserById(id),
};
