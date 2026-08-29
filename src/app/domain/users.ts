/**
 * Admin user-management domain types.
 *
 * Mirrors the backend AdminUserSerializer (read) and
 * AdminUserUpdateSerializer (write) shapes.
 */

/** Read-only admin user-list shape. */
export type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: "ADMIN" | "CUSTOMER";
  is_active: boolean;
  email_verified: boolean;
  date_joined: string;
};

/** Writable fields for PATCH /auth/users/:id/. */
export type AdminUserUpdate = Partial<
  Pick<AdminUser, "username" | "email" | "role" | "is_active" | "email_verified">
>;