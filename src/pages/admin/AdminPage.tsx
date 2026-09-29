import { Suspense, lazy, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { useSeo } from "../../app/hooks/useSeo";
import { T } from "../../app/i18n/strings";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { MaintenanceCard } from "./MaintenanceCard";
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

/* ── Component ── */

export function AdminPage() {
  useSeo({ title: T.admin.pageTitle, noindex: true });
  const { role, canAccessAdmin, hasPerm } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("add-record");
  const [editingRecord, setEditingRecord] = useState<AlbumRecord | null>(null);

  const handleEdit = useCallback((record: AlbumRecord) => {
    setEditingRecord(record);
    setActiveTab("add-record");
  }, []);

  const handleEditDone = useCallback(() => {
    setEditingRecord(null);
  }, []);

  const isAdmin = role === "ADMIN";
  const visibleTabs = TABS.filter(
    (tab) =>
      isAdmin ||
      (tab.perm !== undefined && hasPerm(tab.perm)) ||
      // "Editar" in Punto de venta opens the record form here, even for
      // roles that can edit records but not create them.
      (tab.id === "add-record" && editingRecord !== null)
  );
  const currentTab = visibleTabs.some((t) => t.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id;

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
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== "add-record") setEditingRecord(null);
              }}
              className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${
                currentTab === tab.id
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
          {currentTab === "add-record" && (
            <AddRecordPage
              editingRecord={editingRecord}
              onEditDone={handleEditDone}
            />
          )}
          {currentTab === "manage-records" && (
            <ManageRecordsTab onEdit={handleEdit} />
          )}
          {currentTab === "manage-bazares" && <ManageBazaresTab />}
          {currentTab === "manage-orders" && <ManageOrdersTab />}
          {currentTab === "sales" && <ManageSalesTab />}
          {currentTab === "manage-users" && <ManageUsersTab />}
          {currentTab === "manage-roles" && <ManageRolesTab />}
        </Suspense>
      </div>
    </section>
  );
}
