import { API_BASE_URL } from "../config/api";
import type {
  AuthRepository,
  AuthTokens,
  Credentials,
  RegisterInput,
  User
} from "../domain/auth";
import { http } from "../lib/httpClient";

type AuthServiceConfig = {
  baseUrl?: string;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

type AuthResponse = {
  tokens: {
    access: string;
    refresh?: string;
  };
  user?: User;
  message?: string;
};

const mapTokens = (response: AuthResponse): AuthTokens & { user?: User } => {
  const accessToken = response.tokens?.access;
  const refreshToken = response.tokens?.refresh;

  if (!accessToken) {
    throw new Error("Missing access token in auth response");
  }

  return {
    accessToken,
    refreshToken,
    user: response.user
  };
};

export function createAuthService(config: AuthServiceConfig = {}): AuthRepository {
  const baseUrl = config.baseUrl ?? API_BASE_URL;

  return {
    async login(credentials: Credentials) {
      const response = await http<AuthResponse>(withBase(baseUrl, "/auth/login/"), {
        method: "POST",
        body: credentials
      });
      return mapTokens(response);
    },
    async register(payload: RegisterInput) {
      const response = await http<AuthResponse>(withBase(baseUrl, "/auth/register/"), {
        method: "POST",
        body: payload
      });
      return mapTokens(response);
    },
    async refresh(refreshToken?: string) {
      const response = await http<AuthResponse>(withBase(baseUrl, "/auth/refresh/"), {
        method: "POST",
        body: { refreshToken }
      });
      return mapTokens(response);
    },
    async getProfile(token?: string) {
      return http<User>(withBase(baseUrl, "/auth/me/"), {
        token
      });
    }
  };
}
