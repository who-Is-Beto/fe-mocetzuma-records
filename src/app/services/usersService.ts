import { API_BASE_URL } from "../config/api";
import type { AdminUser, AdminUserUpdate, Role, RoleCatalog, RoleInput } from "../domain/users";
import { http } from "../lib/httpClient";

type UsersServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

/**
 * Repository for the admin user-management /auth/users/ and /roles/ APIs.
 * /roles/ is ADMIN-only; /auth/users/ list/delete also accept a custom role
 * with the matching Administración permissions.
 */
export function createUsersService(config: UsersServiceConfig = {}): {
  list(): Promise<AdminUser[]>;
  update(userId: number, patch: AdminUserUpdate): Promise<AdminUser>;
  remove(userId: number): Promise<{ message?: string }>;
  getRoleCatalog(): Promise<RoleCatalog>;
  listRoles(): Promise<Role[]>;
  createRole(input: RoleInput): Promise<Role>;
  updateRole(roleId: number, input: Partial<RoleInput>): Promise<Role>;
  removeRole(roleId: number): Promise<{ message?: string }>;
} {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;

  return {
    async list() {
      return http<AdminUser[]>(withBase(baseUrl, "/auth/users"), {
        token: getToken?.() ?? undefined
      });
    },
    async update(userId, patch) {
      return http<AdminUser>(withBase(baseUrl, `/auth/users/${userId}`), {
        method: "PATCH",
        token: getToken?.() ?? undefined,
        body: patch
      });
    },
    async remove(userId) {
      return http<{ message?: string }>(
        withBase(baseUrl, `/auth/users/${userId}/delete`),
        { method: "DELETE", token: getToken?.() ?? undefined }
      );
    },
    async getRoleCatalog() {
      return http<RoleCatalog>(withBase(baseUrl, "/roles/catalog"), {
        token: getToken?.() ?? undefined
      });
    },
    async listRoles() {
      return http<Role[]>(withBase(baseUrl, "/roles"), {
        token: getToken?.() ?? undefined
      });
    },
    async createRole(input) {
      return http<Role>(withBase(baseUrl, "/roles"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: input
      });
    },
    async updateRole(roleId, input) {
      return http<Role>(withBase(baseUrl, `/roles/${roleId}`), {
        method: "PATCH",
        token: getToken?.() ?? undefined,
        body: input
      });
    },
    async removeRole(roleId) {
      return http<{ message?: string }>(withBase(baseUrl, `/roles/${roleId}`), {
        method: "DELETE",
        token: getToken?.() ?? undefined
      });
    }
  };
}