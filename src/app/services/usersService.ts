import { API_BASE_URL } from "../config/api";
import type { AdminUser, AdminUserUpdate } from "../domain/users";
import { http } from "../lib/httpClient";

type UsersServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

/**
 * Repository for the admin user-management /auth/users/ API.
 * Every call requires an ADMIN token.
 */
export function createUsersService(config: UsersServiceConfig = {}): {
  list(): Promise<AdminUser[]>;
  update(userId: number, patch: AdminUserUpdate): Promise<AdminUser>;
  remove(userId: number): Promise<{ message?: string }>;
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
    }
  };
}