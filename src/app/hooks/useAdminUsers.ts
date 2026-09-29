import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminUser, AdminUserUpdate } from "../domain/users";
import { createUsersService } from "../services/usersService";
import { extractErrorMessage } from "../lib/httpClient";

type Options = {
  token: string | null;
};

/**
 * Admin user manager (GET/PATCH/DELETE /auth/users/:id). `updateUser` and
 * `deleteUser` apply the change optimistically-ish (in-place list update after
 * the server responds) and throw on failure so the page can surface toasts.
 */
export function useAdminUsers({ token }: Options): {
  users: AdminUser[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  updateUser(userId: number, patch: AdminUserUpdate): Promise<AdminUser>;
  deleteUser(userId: number): Promise<{ message?: string }>;
} {
  const usersService = useMemo(
    () => createUsersService({ getToken: () => token }),
    [token]
  );
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await usersService.list();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(extractErrorMessage(err, "Error al cargar los usuarios."));
    } finally {
      setLoading(false);
    }
  }, [usersService, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateUser = useCallback(
    async (userId: number, patch: AdminUserUpdate): Promise<AdminUser> => {
      const updated = await usersService.update(userId, patch);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...updated } : u))
      );
      return updated;
    },
    [usersService]
  );

  const deleteUser = useCallback(
    async (userId: number): Promise<{ message?: string }> => {
      const result = await usersService.remove(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      return result;
    },
    [usersService]
  );

  return { users, loading, error, load, updateUser, deleteUser };
}