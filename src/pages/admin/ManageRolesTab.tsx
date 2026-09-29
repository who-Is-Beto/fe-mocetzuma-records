import { useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { T } from "../../app/i18n/strings";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { useAdminRoles } from "../../app/hooks/useAdminRoles";
import type { CatalogTab, Role, RoleCatalog } from "../../app/domain/users";

const S = T.admin.manageRoles;

const checkboxClass = "h-4 w-4 shrink-0 accent-orange disabled:opacity-40";

/** Human summary of a saved role, per tab it can open. */
function describeRole(role: Role, catalog: RoleCatalog) {
  const perms = new Set(role.permissions);
  if (!perms.has(catalog.access.codename)) return null;
  return catalog.tabs
    .filter((tab) => perms.has(tab.codename))
    .map((tab) => {
      const actions = tab.actions.filter((a) => perms.has(a.codename)).map((a) => a.label);
      return { id: tab.id, label: tab.label, actions };
    });
}

/* ── Component ── */

export function ManageRolesTab() {
  const { token } = useAuth();
  const { roles, catalog, loading, error, load, createRole, updateRole, deleteRole } =
    useAdminRoles({ token });

  const [editing, setEditing] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subTab, setSubTab] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hasAccess = catalog !== null && selected.has(catalog.access.codename);
  const selectedTabs = catalog?.tabs.filter((t) => selected.has(t.codename)) ?? [];
  const activeSubTab = selectedTabs.find((t) => t.id === subTab) ?? selectedTabs[0];

  const flash = (ok: boolean, text: string) => {
    setMessage({ ok, text });
    setTimeout(() => setMessage(null), ok ? 3000 : 4000);
  };

  const resetForm = () => {
    setEditing(null);
    setName("");
    setSelected(new Set());
    setSubTab(null);
  };

  const startEdit = (role: Role) => {
    setEditing(role);
    setName(role.name);
    setSelected(new Set(role.permissions));
    setSubTab(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* Level 1: turning access off clears everything below it (the backend would drop it anyway). */
  const toggleAccess = (on: boolean) => {
    if (!catalog) return;
    setSelected(on ? new Set([catalog.access.codename]) : new Set());
    setSubTab(null);
  };

  /* Level 2: a newly enabled tab starts with all its actions; untick what the role shouldn't do. */
  const toggleTab = (tab: CatalogTab, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const code of [tab.codename, ...tab.actions.map((a) => a.codename)]) {
        if (on) next.add(code);
        else next.delete(code);
      }
      return next;
    });
    if (on) setSubTab(tab.id);
  };

  /* Level 3 */
  const toggleAction = (codename: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(codename);
      else next.delete(codename);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const input = { name: name.trim(), permissions: [...selected] };
      if (editing) {
        await updateRole(editing.id, input);
        flash(true, S.updated);
      } else {
        await createRole(input);
        flash(true, S.created);
      }
      resetForm();
    } catch (err) {
      flash(false, extractErrorMessage(err, S.error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: Role) => {
    setDeleting(true);
    try {
      await deleteRole(role.id);
      if (editing?.id === role.id) resetForm();
      flash(true, S.deleted);
    } catch (err) {
      flash(false, extractErrorMessage(err, S.error));
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  /* ── Render ── */

  return (
    <div>
      <h2 className="font-display text-xl sm:text-2xl text-denim">{S.title}</h2>
      <p className="mt-1 text-xs sm:text-sm text-navy/60">{S.subtitle}</p>

      {message && (
        <div
          role="status"
          className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
            message.ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <Button tone="outline" className="ml-3 px-3 py-1 text-xs" onClick={() => void load()}>
            {T.shared.retry}
          </Button>
        </div>
      )}

      {loading && (
        <div className="mt-8 flex justify-center">
          <p className="text-sm text-navy/50 animate-pulse">{T.shared.loading}</p>
        </div>
      )}

      {!loading && !error && catalog && (
        <>
          {/* ── Role editor ── */}
          <div className="mt-5 rounded-2xl border border-navy/10 bg-white/60 p-4 backdrop-blur sm:p-5">
            <h3 className="text-sm font-semibold text-navy">
              {editing ? `${S.edit}: ${editing.name}` : S.newRole}
            </h3>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={S.namePlaceholder}
              maxLength={150}
              aria-label={S.namePlaceholder}
              className="mt-3 w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
            />

            {/* 1 · Access to Administración */}
            <fieldset className="mt-5">
              <legend className="text-[11px] font-semibold uppercase tracking-wider text-navy/50">
                {S.step1}
              </legend>
              <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-navy/10 bg-white px-3 py-3">
                <input
                  type="checkbox"
                  checked={hasAccess}
                  onChange={(e) => toggleAccess(e.target.checked)}
                  className={`${checkboxClass} mt-0.5`}
                />
                <span>
                  <span className="block text-sm font-semibold text-navy">{catalog.access.label}</span>
                  <span className="block text-xs text-navy/50">{S.accessHelp}</span>
                </span>
              </label>
            </fieldset>

            {/* 2 · Visible tabs */}
            <fieldset className="mt-5" disabled={!hasAccess}>
              <legend className="text-[11px] font-semibold uppercase tracking-wider text-navy/50">
                {S.step2}
              </legend>
              {!hasAccess && <p className="mt-1 text-xs text-navy/40">{S.needsAccess}</p>}
              <div className={`mt-2 grid gap-2 sm:grid-cols-2 ${hasAccess ? "" : "opacity-50"}`}>
                {catalog.tabs.map((tab) => (
                  <label
                    key={tab.id}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-navy/10 bg-white px-3 py-2.5 text-sm text-navy has-[:disabled]:cursor-not-allowed"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(tab.codename)}
                      onChange={(e) => toggleTab(tab, e.target.checked)}
                      className={checkboxClass}
                    />
                    {tab.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* 3 · Per-tab permissions (sub-tabs) */}
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/50">{S.step3}</p>
              {selectedTabs.length === 0 || !activeSubTab ? (
                <p className="mt-1 text-xs text-navy/40">{S.needsTabs}</p>
              ) : (
                <div className="mt-2 rounded-xl border border-navy/10 bg-white">
                  <div
                    role="tablist"
                    aria-label={S.step3}
                    className="flex gap-1 overflow-x-auto border-b border-navy/10 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {selectedTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={tab.id === activeSubTab.id}
                        onClick={() => setSubTab(tab.id)}
                        className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          tab.id === activeSubTab.id
                            ? "bg-orange text-charcoal"
                            : "text-navy/60 hover:bg-cream hover:text-navy"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div role="tabpanel" className="space-y-2 p-3">
                    <p className="flex items-center gap-2 text-xs text-navy/50">
                      <span aria-hidden="true">👁</span>
                      {S.viewIncluded}
                    </p>
                    {activeSubTab.actions.map((action) => (
                      <label
                        key={action.codename}
                        className="flex cursor-pointer items-center gap-2 text-sm text-navy"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(action.codename)}
                          onChange={(e) => toggleAction(action.codename, e.target.checked)}
                          className={checkboxClass}
                        />
                        {action.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                tone="orange"
                className="px-5 py-2.5 text-sm"
                disabled={saving || !name.trim()}
                onClick={() => void save()}
              >
                {saving ? S.saving : editing ? S.save : S.create}
              </Button>
              {editing && (
                <Button tone="outline" className="px-5 py-2.5 text-sm" onClick={resetForm}>
                  {S.cancel}
                </Button>
              )}
            </div>
          </div>

          {/* ── Existing roles ── */}
          {roles.length === 0 ? (
            <p className="mt-8 text-center text-sm text-navy/50">{S.empty}</p>
          ) : (
            <div className="mt-5 space-y-2">
              {roles.map((role) => {
                const tabs = describeRole(role, catalog);
                return (
                  <div
                    key={role.id}
                    className="rounded-xl border border-navy/10 bg-white/60 p-3 backdrop-blur sm:p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-semibold text-navy">
                          {role.name}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              tabs ? "bg-green-100 text-green-700" : "bg-navy/5 text-navy/50"
                            }`}
                          >
                            {tabs ? S.withAccess : S.withoutAccess}
                          </span>
                        </p>
                        <p className="text-xs text-navy/50">
                          {S.users.replace("{count}", String(role.user_count))}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => startEdit(role)}
                          className="rounded-full border border-navy/15 px-3 py-1 text-[11px] font-semibold text-navy transition hover:border-orange hover:text-orange"
                        >
                          {S.edit}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(role)}
                          className="rounded-full border border-red-200 px-3 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          {S.delete}
                        </button>
                      </div>
                    </div>
                    {tabs && tabs.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {tabs.map((tab) => (
                          <li key={tab.id} className="text-xs text-navy/70">
                            <span className="font-semibold text-navy">{tab.label}:</span>{" "}
                            {tab.actions.length ? tab.actions.join(" · ") : S.viewOnly}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={S.delete}
        message={S.confirmDelete.replace("{name}", confirmDelete?.name ?? "")}
        confirmLabel={S.delete}
        busyLabel="Eliminando..."
        busy={deleting}
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
