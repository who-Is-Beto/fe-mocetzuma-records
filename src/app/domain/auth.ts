export type User = {
  id: string;
  name: string;
  email?: string;
};

export type Credentials = {
  email: string;
  password: string;
};

export type RegisterInput = Credentials & {
  username: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

export interface AuthRepository {
  login(credentials: Credentials): Promise<AuthTokens & { user?: User }>;
  register(payload: RegisterInput): Promise<AuthTokens & { user?: User }>;
  refresh(refreshToken?: string): Promise<AuthTokens>;
  getProfile(token?: string): Promise<User>;
}
