export type User = {
  id: string;
  name: string;
  email?: string;
  emailVerified?: boolean;
};

export type Credentials = {
  email: string;
  password: string;
};

export type RegisterInput = Credentials & {
  username: string;
};

export type VerifyEmailInput = {
  uid: string;
  token: string;
};

export type ResendVerificationInput = {
  email: string;
};

export type PasswordResetRequestInput = {
  email: string;
};

export type PasswordResetConfirmInput = {
  uid: string;
  token: string;
  new_password: string;
  confirm_password: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type AuthSession = AuthTokens & {
  user?: User;
  emailVerified?: boolean;
};

export type VerifyEmailResult = {
  message?: string;
  emailVerified?: boolean;
};

export interface AuthRepository {
  login(credentials: Credentials): Promise<AuthSession>;
  register(payload: RegisterInput): Promise<AuthSession>;
  refresh(refreshToken?: string): Promise<AuthTokens>;
  getProfile(token?: string): Promise<User>;
  verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResult>;
  resendVerification(input: ResendVerificationInput): Promise<{ message?: string }>;
  requestPasswordReset(input: PasswordResetRequestInput): Promise<{ message?: string }>;
  confirmPasswordReset(input: PasswordResetConfirmInput): Promise<{ message?: string }>;
}
