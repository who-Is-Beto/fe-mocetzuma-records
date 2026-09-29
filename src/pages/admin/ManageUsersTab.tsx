import { useCallback, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { T } from "../../app/i18n/strings";
import { Button } from "../../components/Button";
import { Dropdown, DropdownCheckboxItem } from "../../components/Dropdown";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { useAdminUsers } from "../../app/hooks/useAdminUsers";
import { useAdminRoles } from "../../app/hooks/useAdminRoles";
import type { AdminUser, AdminUserUpdate } from "../../app/domain/users";

/* ── Component ── */

export function ManageUsersTab() {
  const { token, user: currentUser, role: myRole, hasPerm } = useAuth();
  const isAdmin = myRole === "ADMIN";
  const {
    users,
    loading,
    error,
    load,
    updateUser,
    deleteUser: deleteUserById,
  } = useAdminUsers({ token });
  // Roles/assignment are ADMIN-only; skip the request for delegated users.
  const { roles } = useAdminRoles({ token: isAdmin ? token : null });

  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /* ── Update roles ── */

  const update = useCallback(
    async (userId: number, patch: AdminUserUpdate) => {
      setUpdatingId(userId);
      setSuccessMessage(null);
      setActionError(null);
      try {
        await updateUser(userId, patch);
        setSuccessMessage(T.admin.manageUsers.roleUpdated);
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: unknown) {
        setActionError(extractErrorMessage(err, T.admin.manageUsers.roleError));
        setTimeout(() => setActionError(null), 4000);
      } finally {
        setUpdatingId(null);
      }
    },
    [updateUser]
  );

  /* ── Delete user ── */

  const deleteUser = useCallback(
    async (userId: number) => {
      setDeletingId(userId);
      setConfirmDelete(null);
      setSuccessMessage(null);
      setActionError(null);
      try {
        await deleteUserById(userId);
        setSuccessMessage("Usuario eliminado correctamente.");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: unknown) {
        setActionError(extractErrorMessage(err, "No se pudo eliminar el usuario."));
        setTimeout(() => setActionError(null), 4000);
      } finally {
        setDeletingId(null);
      }
    },
    [deleteUserById]
  );

  /* ── Filtered list ── */

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  /* ── Check if a user row belongs to the current user ── */
  const isCurrentUser = (u: AdminUser): boolean =>
    Boolean(currentUser?.email && u.email === currentUser.email);

  const bannerError = error || actionError;

  /* ── Roles: Administrador + any number of custom roles (desktop + mobile) ── */

  const canDeleteUser = (u: AdminUser): boolean =>
    !isCurrentUser(u) && (isAdmin || (hasPerm("apiApp.delete_user") && u.role !== "ADMIN"));

  const rolesPicker = (u: AdminUser) => {
    const assigned = [
      ...(u.role === "ADMIN" ? [T.admin.manageUsers.roles.admin] : []),
      ...u.group_names,
    ];
    const chips = (
      <span className="flex flex-wrap gap-1">
        {assigned.length ? (
          assigned.map((name) => (
            <span
              key={name}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                name === T.admin.manageUsers.roles.admin && u.role === "ADMIN"
                  ? "bg-orange/15 text-orange"
                  : "bg-sun/50 text-navy"
              }`}
            >
              {name}
            </span>
          ))
        ) : (
          <span className="text-xs text-navy/50">{T.admin.manageUsers.roles.customer}</span>
        )}
      </span>
    );
    // Assigning roles is ADMIN-only (backend enforces it too).
    if (!isAdmin) return chips;

    const busy = updatingId === u.id;
    return (
      <Dropdown label={chips} ariaLabel={`${T.admin.manageUsers.table.role}: ${u.username}`}>
        <DropdownCheckboxItem
          checked={u.role === "ADMIN"}
          disabled={busy || isCurrentUser(u)}
          title={isCurrentUser(u) ? T.admin.manageUsers.ownAdmin : undefined}
          onToggle={() => update(u.id, { role: u.role === "ADMIN" ? "CUSTOMER" : "ADMIN" })}
        >
          {T.admin.manageUsers.roles.admin}
        </DropdownCheckboxItem>
        {roles.map((r) => {
          const assignedRole = u.groups.includes(r.id);
          return (
            <DropdownCheckboxItem
              key={r.id}
              checked={assignedRole}
              disabled={busy}
              onToggle={() =>
                update(u.id, {
                  groups: assignedRole
                    ? u.groups.filter((id) => id !== r.id)
                    : [...u.groups, r.id],
                })
              }
            >
              {r.name}
            </DropdownCheckboxItem>
          );
        })}
        {roles.length === 0 && (
          <p className="px-3 py-2 text-[11px] text-navy/40">{T.admin.manageUsers.noCustomRoles}</p>
        )}
      </Dropdown>
    );
  };

  /* ── Render ── */

  return (
    <div>
      <h2 className="font-display text-xl sm:text-2xl text-denim">
        {T.admin.manageUsers.title}
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-navy/60">
        {T.admin.manageUsers.subtitle}
      </p>

      {/* ── Search ── */}
      <div className="mt-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={T.admin.manageUsers.searchPlaceholder}
          className="w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
        />
      </div>

      {/* ── Success ── */}
      {successMessage && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {/* ── Error ── */}
      {bannerError && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {bannerError}
          <Button
            tone="outline"
            className="ml-3 px-3 py-1 text-xs"
            onClick={() => void load()}
          >
            {T.shared.retry}
          </Button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="mt-8 flex justify-center">
          <p className="text-sm text-navy/50 animate-pulse">{T.shared.loading}</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !bannerError && filteredUsers.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg text-navy/40">👥</p>
          <p className="mt-2 text-sm text-navy/50">
            {search.trim()
              ? T.admin.manageUsers.noResults
              : T.admin.manageUsers.empty}
          </p>
        </div>
      )}

      {/* ── Users table (desktop) ── */}
      {!loading && filteredUsers.length > 0 && (
        <>
          <p className="mt-4 text-xs text-navy/40">
            {T.admin.manageUsers.total
              .replace("{count}", String(filteredUsers.length))}
          </p>

          {/* Desktop table */}
          <div className="mt-3 hidden overflow-hidden rounded-2xl border border-navy/10 bg-white/60 backdrop-blur md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-navy/10 bg-cream/60 text-[11px] uppercase tracking-wider text-navy/50">
                  <th className="px-4 py-3 font-semibold">
                    {T.admin.manageUsers.table.username}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {T.admin.manageUsers.table.email}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {T.admin.manageUsers.table.role}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {T.admin.manageUsers.table.emailVerified}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {T.admin.manageUsers.table.status}
                  </th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-navy/5 transition hover:bg-sun/10 last:border-0"
                  >
                    <td className="max-w-[160px] truncate px-4 py-3 font-medium text-navy">
                      {u.username}
                      {isCurrentUser(u) && (
                        <span className="ml-1.5 text-[10px] text-orange">
                          (tú)
                        </span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-navy/70">
                      {u.email || "—"}
                    </td>
                    <td className="px-4 py-3">{rolesPicker(u)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          u.email_verified
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {u.email_verified
                          ? T.admin.manageUsers.badges.verified
                          : T.admin.manageUsers.badges.pending}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          u.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setConfirmDelete(u)}
                        disabled={!canDeleteUser(u) || deletingId === u.id}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                          !canDeleteUser(u) || deletingId === u.id
                            ? "cursor-not-allowed border-navy/10 text-navy/30"
                            : "border-red-200 text-red-600 hover:bg-red-50"
                        }`}
                      >
                        {deletingId === u.id ? "..." : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-3 space-y-2 md:hidden">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-navy/10 bg-white/60 p-3 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">
                      {u.username}
                      {isCurrentUser(u) && (
                        <span className="ml-1.5 text-[10px] text-orange">
                          (tú)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-navy/60">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        u.email_verified
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {u.email_verified
                        ? T.admin.manageUsers.badges.verified
                        : T.admin.manageUsers.badges.pending}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      u.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {u.is_active ? "Activo" : "Inactivo"}
                  </span>
                  <button
                    onClick={() => setConfirmDelete(u)}
                    disabled={!canDeleteUser(u) || deletingId === u.id}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                      !canDeleteUser(u) || deletingId === u.id
                        ? "cursor-not-allowed border-navy/10 text-navy/30"
                        : "border-red-200 text-red-600 hover:bg-red-50"
                    }`}
                  >
                    {deletingId === u.id ? "..." : "Eliminar"}
                  </button>
                </div>
                <div className="mt-2">{rolesPicker(u)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Delete confirmation modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-navy/10 bg-sand p-6 shadow-panel">
            <h3 className="font-display text-lg text-denim">Eliminar usuario</h3>
            <p className="mt-2 text-sm text-navy/60">
              ¿Estás seguro de que quieres eliminar a{" "}
              <span className="font-semibold text-navy">{confirmDelete.username}</span>{" "}
              ({confirmDelete.email})? Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                tone="outline"
                className="flex-1 py-2.5 text-sm"
                onClick={() => setConfirmDelete(null)}
              >
                Cancelar
              </Button>
              <button
                onClick={() => deleteUser(confirmDelete.id)}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === confirmDelete.id ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}