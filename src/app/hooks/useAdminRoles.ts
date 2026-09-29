import { useCallback, useEffect, useMemo, useState } from "react";
import type { Role, RoleCatalog, RoleInput } from "../domain/users";
import { createUsersService } from "../services/usersService";
import { extractErrorMessage } from "../lib/httpClient";

/**
 * Admin custom-role manager (/roles/ + /roles/catalog/). ADMIN-only: pass a
 * null token to skip loading. Mutations update the local list after the
 * server responds and throw on failure so the tab can surface the error.
 */
export function useAdminRoles({ token }: { token: string | null }) {
  const usersService = useMemo(
    () => createUsersService({ getToken: () => token }),
    [token]
  );
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<RoleCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [roleList, roleCatalog] = await Promise.all([
        usersService.listRoles(),
        usersService.getRoleCatalog(),
      ]);
      setRoles(roleList);
      setCatalog(roleCatalog);
    } catch (err) {
      setError(extractErrorMessage(err, "Error al cargar los roles."));
    } finally {
      setLoading(false);
    }
  }, [usersService, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const createRole = useCallback(
    async (input: RoleInput) => {
      const role = await usersService.createRole(input);
      setRoles((prev) => [...prev, role].sort((a, b) => a.name.localeCompare(b.name)));
      return role;
    },
    [usersService]
  );

  const updateRole = useCallback(
    async (roleId: number, input: Partial<RoleInput>) => {
      const role = await usersService.updateRole(roleId, input);
      setRoles((prev) => prev.map((r) => (r.id === roleId ? role : r)));
      return role;
    },
    [usersService]
  );

  const deleteRole = useCallback(
    async (roleId: number) => {
      await usersService.removeRole(roleId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    },
    [usersService]
  );

  return { roles, catalog, loading, error, load, createRole, updateRole, deleteRole };
}
