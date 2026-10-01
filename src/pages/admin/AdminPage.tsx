import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { useSeo } from "../../app/hooks/useSeo";
import { T } from "../../app/i18n/strings";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { MaintenanceCard } from "./MaintenanceCard";
import { createRecordService } from "../../app/services/recordService";
import type { Record as AlbumRecord } from "../../app/domain/album";

/* ── Tab-level code splitting: only the active tab is loaded ── */
const AddRecordPage = lazy(() =>
  import("./AddRecordPage").then((m) => ({ default: m.AddRecordPage }))
);
const ManageRecordsTab = lazy(() =>
  import("./ManageRecordsTab").then((m) => ({ default: m.ManageRecordsTab }))
);
const ManageUsersTab = lazy(() =>
  import("./ManageUsersTab").then((m) => ({ default: m.ManageUsersTab }))
);
const ManageOrdersTab = lazy(() =>
  import("./ManageOrdersTab").then((m) => ({ default: m.ManageOrdersTab }))
);
const ManageBazaresTab = lazy(() =>
  import("./ManageBazaresTab").then((m) => ({ default: m.ManageBazaresTab }))
);
const ManageRolesTab = lazy(() =>
  import("./ManageRolesTab").then((m) => ({ default: m.ManageRolesTab }))
);
const ManageSalesTab = lazy(() =>
  import("./ManageSalesTab").then((m) => ({ default: m.ManageSalesTab }))
);

/* ── Tabs ──
 * `perm`: a non-ADMIN sees the tab when their custom role grants it (Roles tab).
 * No `perm` → ADMIN only. The backend enforces the same permissions. */

const TABS = [
  { id: "add-record" as const, label: T.admin.tabs.addRecord, icon: "➕", perm: "apiApp.tab_add_record" },
  { id: "manage-records" as const, label: T.admin.tabs.manageRecords, icon: "🏪", perm: "apiApp.tab_manage_records" },
  { id: "manage-bazares" as const, label: T.admin.tabs.manageBazares, icon: "🎪", perm: "apiApp.tab_manage_bazares" },
  { id: "manage-orders" as const, label: T.admin.tabs.manageOrders, icon: "📦", perm: "apiApp.tab_manage_orders" },
  { id: "sales" as const, label: T.admin.tabs.sales, icon: "🧾", perm: "apiApp.tab_sales" },
  { id: "manage-users" as const, label: T.admin.tabs.manageUsers, icon: "👥", perm: "apiApp.tab_manage_users" },
  { id: "manage-roles" as const, label: T.admin.tabs.manageRoles, icon: "🔐" },
];

type TabId = (typeof TABS)[number]["id"];

const isTabId = (value: string | null): value is TabId =>
  TABS.some((t) => t.id === value);

/** Where Punto de venta should land after the editor closes. */
export type EditReturn = { recordId: AlbumRecord["id"]; scrollY: number };

/* ── Component ── */

export function AdminPage() {
  useSeo({ title: T.admin.pageTitle, noindex: true });
  const { role, canAccessAdmin, hasPerm, token } = useAuth();
  const navigate = useNavigate();
  /* URL is the source of truth (survives reloads and Back):
   *   ?tab=<TabId>            active tab
   *   &q=…&page=…             Punto de venta search/page (owned by that tab)
   *   &edit=<record id>       record editor open, over the tab it came from */
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabId = isTabId(tabParam) ? tabParam : "add-record";
  const editId = searchParams.get("edit");
  const [editingRecord, setEditingRecord] = useState<AlbumRecord | null>(null);
  // Which ?edit= id failed to load (derived per id, so no reset-in-effect).
  const [failedEditId, setFailedEditId] = useState<string | null>(null);
  const editLoadError = editId !== null && failedEditId === editId;
  // Set when the editor closes; Punto de venta restores scroll + highlights the row.
  const [editReturn, setEditReturn] = useState<EditReturn | null>(null);
  const openScrollRef = useRef(0);
  // True when this session pushed the ?edit= entry (so closing can go Back).
  const pushedEditRef = useRef(false);
  const recordService = useMemo(
    () => createRecordService({ getToken: () => token }),
    [token]
  );

  // Reload / shared link with ?edit=: fetch the full record ourselves.
  useEffect(() => {
    if (!editId || String(editingRecord?.id) === editId) return;
    let cancelled = false;
    recordService
      .getForEdit(editId)
      .then((record) => !cancelled && setEditingRecord(record))
      .catch(() => !cancelled && setFailedEditId(editId));
    return () => {
      cancelled = true;
    };
  }, [editId, editingRecord?.id, recordService]);

  const handleEdit = useCallback(
    (record: AlbumRecord) => {
      openScrollRef.current = window.scrollY;
      pushedEditRef.current = true;
      setEditReturn(null);
      setEditingRecord(record);
      const next = new URLSearchParams(searchParams);
      next.set("edit", String(record.id));
      setSearchParams(next); // push: Back also closes the editor
      window.scrollTo({ top: 0 });
    },
    [searchParams, setSearchParams]
  );

  const handleEditDone = useCallback(() => {
    if (editingRecord) {
      setEditReturn({ recordId: editingRecord.id, scrollY: openScrollRef.current });
    }
    // editingRecord is kept: the editor's visibility follows ?edit=, and clearing
    // it before the URL pops would make the load effect refetch the record.
    if (pushedEditRef.current) {
      pushedEditRef.current = false;
      navigate(-1); // back to the exact list entry (same tab/q/page)
    } else {
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
  }, [editingRecord, navigate, searchParams, setSearchParams]);

  const selectTab = (tab: TabId) => {
    pushedEditRef.current = false;
    setEditingRecord(null);
    setEditReturn(null);
    // q/page belong to Punto de venta; a new tab starts clean.
    setSearchParams(new URLSearchParams({ tab }));
  };

  const isAdmin = role === "ADMIN";
  const visibleTabs = TABS.filter(
    (tab) =>
      isAdmin ||
      (tab.perm !== undefined && hasPerm(tab.perm)) ||
      // "Editar" in Punto de venta opens the record form here, even for
      // roles that can edit records but not create them.
      (tab.id === "add-record" && editId !== null)
  );
  const currentTab = visibleTabs.some((t) => t.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id;
  const editing = editId !== null;
  // While editing, the tab bar shows the form's tab; the origin stays in ?tab=.
  const highlightedTab = editing ? "add-record" : currentTab;

  /* ── Access guard (ADMIN or "Acceso a Administración") ── */
  if (!canAccessAdmin) {
    return (
      <section className="mx-auto max-w-2xl py-20 text-center">
        <p className="text-lg font-semibold text-navy/60">
          No tienes acceso a esta sección.
        </p>
        <Button tone="navy" className="mt-6" onClick={() => navigate("/")}>
          Volver al inicio
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl py-6 sm:py-10 px-2 sm:px-0">
      {/* ── Header ── */}
      <h1 className="font-display text-2xl sm:text-3xl text-denim">
        {T.admin.pageTitle}
      </h1>
      <p className="mt-2 text-xs sm:text-sm text-navy/60">
        {T.admin.pageSubtitle}
      </p>

      {/* ── Maintenance window (ADMIN, or a role with the maintenance section) ── */}
      {hasPerm("apiApp.view_siteconfig") && <MaintenanceCard />}

      {/* ── Tab bar (scrolls horizontally on mobile; a role may grant only the maintenance card) ── */}
      {visibleTabs.length > 0 && (
        <div className="mt-6 sm:mt-8 flex gap-1 justify-between overflow-x-auto rounded-2xl border border-navy/10 bg-cream/60 p-1.5 backdrop-blur lg:mx-auto lg:w-[calc(70%+2rem)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              aria-current={highlightedTab === tab.id ? "page" : undefined}
              className={`flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${
                highlightedTab === tab.id
                  ? "bg-orange text-charcoal shadow-sm"
                  : "text-navy/60 hover:text-navy hover:bg-white/60"
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Tab content ── */}
      <div className="mt-6">
        <Suspense fallback={<Loader />}>
          {editing && editLoadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              No se pudo abrir el disco para editar.
              <Button tone="outline" className="ml-3 px-3 py-1 text-xs" onClick={handleEditDone}>
                Volver
              </Button>
            </div>
          )}
          {editing && !editLoadError && !editingRecord && <Loader />}
          {editing && editingRecord && (
            <AddRecordPage
              key={editingRecord.id}
              editingRecord={editingRecord}
              onEditDone={handleEditDone}
            />
          )}
          {!editing && currentTab === "add-record" && <AddRecordPage />}
          {currentTab === "manage-records" && (
            // Stays mounted (hidden) while editing so the sale ticket, the
            // search box and the loaded page survive the round trip.
            <div hidden={editing}>
              <ManageRecordsTab
                onEdit={handleEdit}
                editReturn={editing ? null : editReturn}
                onReturnHandled={() => setEditReturn(null)}
              />
            </div>
          )}
          {!editing && currentTab === "manage-bazares" && <ManageBazaresTab />}
          {!editing && currentTab === "manage-orders" && <ManageOrdersTab />}
          {!editing && currentTab === "sales" && <ManageSalesTab />}
          {!editing && currentTab === "manage-users" && <ManageUsersTab />}
          {!editing && currentTab === "manage-roles" && <ManageRolesTab />}
        </Suspense>
      </div>
    </section>
  );
}
