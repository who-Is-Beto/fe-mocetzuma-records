import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { usePageTitle } from "../../app/hooks/usePageTitle";
import { T } from "../../app/i18n/strings";
import { Button } from "../../components/Button";
import { AddRecordPage } from "./AddRecordPage";
import { ManageRecordsTab } from "./ManageRecordsTab";
import { ManageUsersTab } from "./ManageUsersTab";
import { ManageOrdersTab } from "./ManageOrdersTab";
import type { Record as AlbumRecord } from "../../app/domain/album";

/* ── Tabs ── */

const TABS = [
  { id: "add-record" as const, label: T.admin.tabs.addRecord, icon: "➕" },
  { id: "manage-records" as const, label: T.admin.tabs.manageRecords, icon: "💿" },
  { id: "manage-orders" as const, label: T.admin.tabs.manageOrders, icon: "📦" },
  { id: "manage-users" as const, label: T.admin.tabs.manageUsers, icon: "👥" },
];

type TabId = (typeof TABS)[number]["id"];

/* ── Component ── */

export function AdminPage() {
  usePageTitle(T.admin.pageTitle);
  const { role } = useAuth();
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

  /* ── Admin guard ── */
  if (role !== "ADMIN") {
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

      {/* ── Tab bar (scrolls horizontally on mobile) ── */}
      <div className="mt-6 sm:mt-8 flex gap-1 justify-between overflow-x-auto rounded-2xl border border-navy/10 bg-cream/60 p-1.5 backdrop-blur lg:mx-auto lg:w-[calc(70%+2rem)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== "add-record") setEditingRecord(null);
            }}
            className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-orange text-charcoal shadow-sm"
                : "text-navy/60 hover:text-navy hover:bg-white/60"
            }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="mt-6">
        {activeTab === "add-record" && (
          <AddRecordPage
            editingRecord={editingRecord}
            onEditDone={handleEditDone}
          />
        )}
        {activeTab === "manage-records" && (
          <ManageRecordsTab onEdit={handleEdit} />
        )}
        {activeTab === "manage-orders" && <ManageOrdersTab />}
        {activeTab === "manage-users" && <ManageUsersTab />}
      </div>
    </section>
  );
}
