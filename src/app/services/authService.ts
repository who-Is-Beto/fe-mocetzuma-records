import { API_BASE_URL } from "../config/api";
import type {
  AuthRepository,
  AuthSession,
  Credentials,
  RegisterInput,
  ResendVerificationInput,
  User,
  VerifyEmailInput
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
  email_verified?: boolean;
};

const mapTokens = (response: AuthResponse): AuthSession => {
  const accessToken = response.tokens?.access;
  const refreshToken = response.tokens?.refresh;

  if (!accessToken) {
    throw new Error("Missing access token in auth response");
  }

  return {
    accessToken,
    refreshToken,
    user: response.user,
    emailVerified: response.email_verified
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
      const response = await http<{
        id: string;
        username: string;
        email?: string;
        email_verified?: boolean;
      }>(withBase(baseUrl, "/auth/me/"), {
        token
      });
      return {
        id: response.id,
        name: response.username,
        email: response.email,
        emailVerified: response.email_verified
      };
    },
    async verifyEmail({ uid, token }: VerifyEmailInput) {
      const response = await http<{
        message?: string;
        email_verified?: boolean;
      }>(withBase(baseUrl, "/auth/verify-email/"), {
        method: "POST",
        body: { uid, token }
      });
      // Backend responds with snake_case `email_verified`; expose it as
      // camelCase like the rest of the auth domain.
      return {
        message: response.message,
        emailVerified: response.email_verified
      };
    },
    async resendVerification({ email }: ResendVerificationInput) {
      return http<{ message?: string }>(withBase(baseUrl, "/auth/verify-email/resend/"), {
        method: "POST",
        body: { email }
      });
    }
  };
}
