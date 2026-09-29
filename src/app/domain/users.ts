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
  /** Custom role ids (Django Groups); a user can have several. */
  groups: number[];
  /** Read-only names of `groups`, for display. */
  group_names: string[];
};

/** Writable fields for PATCH /auth/users/:id/. */
export type AdminUserUpdate = Partial<
  Pick<
    AdminUser,
    "username" | "email" | "role" | "is_active" | "email_verified" | "groups"
  >
>;

/** One grantable permission (codename without the "apiApp." prefix). */
export type CatalogPermission = { codename: string; label: string };

/** An Administración tab a role can open, plus what it may do inside it. */
export type CatalogTab = CatalogPermission & {
  id: string; // matches AdminPage tab ids, e.g. "manage-orders"
  actions: CatalogPermission[];
};

/**
 * GET /roles/catalog/ — what a role can grant, in three levels:
 * Administración access → tabs → per-tab actions (backend: apiApp/admin_panel.py).
 */
export type RoleCatalog = { access: CatalogPermission; tabs: CatalogTab[] };

/** Custom role (Django Group). `permissions` are catalog codenames. */
export type Role = {
  id: number;
  name: string;
  permissions: string[];
  user_count: number;
};

export type RoleInput = Pick<Role, "name" | "permissions">;