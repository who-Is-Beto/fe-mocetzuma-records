import { API_BASE_URL } from "../config/api";
import type { AuthRepository, AuthTokens, Credentials, User } from "../domain/auth";
import { http } from "../lib/httpClient";

type AuthServiceConfig = {
  baseUrl?: string;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

export function createAuthService(config: AuthServiceConfig = {}): AuthRepository {
  const baseUrl = config.baseUrl ?? API_BASE_URL;

  return {
    async login(credentials: Credentials) {
      return http<AuthTokens & { user?: User }>(withBase(baseUrl, "/auth/login"), {
        method: "POST",
        body: credentials
      });
    },
    async refresh(refreshToken?: string) {
      return http<AuthTokens>(withBase(baseUrl, "/auth/refresh"), {
        method: "POST",
        body: { refreshToken }
      });
    },
    async getProfile(token?: string) {
      return http<User>(withBase(baseUrl, "/auth/me"), {
        token
      });
    }
  };
}
