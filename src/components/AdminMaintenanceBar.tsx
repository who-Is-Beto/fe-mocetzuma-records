import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { T } from "../app/i18n/strings";
import { useAuth } from "../app/providers/AuthProvider";
import { useMaintenanceStatusValue } from "../app/providers/MaintenanceStatusContext";
import { createConfigService } from "../app/services/configService";
import { Button } from "./Button";

/**
 * Admin-only floating bar shown while the maintenance window is open. Lets
 * the admin close the window straight from the storefront without visiting
 * the panel — same admin-only PATCH the panel uses, so non-admin users never
 * see the bar and the backend still rejects anyone without an admin token.
 */
export function AdminMaintenanceBar() {
  const { token } = useAuth();
  const { config, refetch } = useMaintenanceStatusValue();
  const configService = useMemo(() => createConfigService(), []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const closeWindow = async () => {
    if (!token || saving) return;
    setSaving(true);
    setError(false);
    try {
      await configService.setMaintenanceConfig(
        { maintenance_mode: false, maintenance_message: config?.maintenance_message ?? "" },
        token
      );
      refetch();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative z-30 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-orange/30 bg-charcoal/95 px-6 py-2.5 text-cream sm:px-10">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs sm:text-sm">
        <span aria-hidden="true" className="text-base leading-none">🛠️</span>
        <span className="font-semibold">{T.admin.maintenance.quickCloseTitle}</span>
        <span className="hidden text-cream/70 sm:inline">
          {T.admin.maintenance.quickCloseBody}
        </span>
        <span
          role="status"
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${
            error ? "bg-coral text-white" : "bg-orange text-charcoal"
          }`}
        >
          {error
            ? T.admin.maintenance.quickCloseError
            : config?.maintenance_mode
              ? T.admin.maintenance.active
              : T.admin.maintenance.inactive}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/admin"
          className="text-xs font-semibold text-cream/80 underline decoration-orange/50 underline-offset-4 transition hover:text-orange"
        >
          {T.admin.maintenance.goToPanel}
        </Link>
        <Button
          tone="orange"
          className="px-3.5 py-1.5 text-xs"
          onClick={closeWindow}
          disabled={saving || !config?.maintenance_mode}
        >
          {saving ? T.admin.maintenance.quickCloseBusy : T.admin.maintenance.quickClose}
        </Button>
      </div>
    </div>
  );
}