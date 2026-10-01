import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { useServiceQuery } from "../../app/hooks/useServiceQuery";
import { createRecordService } from "../../app/services/recordService";
import { createSalesService } from "../../app/services/salesService";
import { storeDay } from "../../app/lib/format";
import { SalesHistory } from "./sales/SalesHistory";
import { SalesMetricsView } from "./sales/SalesMetricsView";

const inputClass =
  "rounded-xl border border-navy/15 bg-white px-3 py-3 text-sm font-semibold text-navy outline-none transition focus:border-orange";
const labelClass =
  "flex flex-col text-[11px] font-semibold uppercase tracking-wider text-navy/50";

const VIEWS = [
  { id: "history" as const, label: "Registro", icon: "🧾" },
  { id: "metrics" as const, label: "Métricas", icon: "📊" }
];

type View = (typeof VIEWS)[number]["id"];

/* ── Component ── */

export function ManageSalesTab() {
  const { token } = useAuth();
  const salesService = useMemo(() => createSalesService({ getToken: () => token }), [token]);
  const recordService = useMemo(() => createRecordService({ getToken: () => token }), [token]);

  const [view, setView] = useState<View>("history");
  // Default range: this month so far (store time). Shared by both views.
  const [dateFrom, setDateFrom] = useState(() => `${storeDay(new Date()).slice(0, 8)}01`);
  const [dateTo, setDateTo] = useState(() => storeDay(new Date()));
  const [ownerId, setOwnerId] = useState("");

  const fetchOwners = useCallback(() => recordService.getOwners(), [recordService]);
  const owners = useServiceQuery([recordService], fetchOwners, { enabled: Boolean(token) });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl text-denim">Ventas</h2>
          <p className="mt-1 text-xs sm:text-sm text-navy/70">
            {view === "history"
              ? "Ventas registradas en el Punto de venta, por fecha y dueño."
              : "Punto de venta y compras en línea del periodo."}
          </p>
        </div>

        {/* ── Registro / Métricas ── */}
        <div className="flex w-full gap-1 rounded-2xl border border-navy/10 bg-cream/60 p-1 backdrop-blur sm:w-auto">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition sm:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 ${
                view === v.id
                  ? "bg-orange text-charcoal shadow-sm"
                  : "text-navy/80 hover:bg-white/60 hover:text-navy"
              }`}
            >
              <span aria-hidden="true" className="text-base leading-none">{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className={`mt-4 grid grid-cols-1 gap-2 ${view === "history" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <label className={labelClass}>
          Desde
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Hasta
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        {view === "history" && (
          <label className={labelClass}>
            Dueño
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">Todos los dueños</option>
              {(owners.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {view === "history" ? (
        <SalesHistory salesService={salesService} dateFrom={dateFrom} dateTo={dateTo} ownerId={ownerId} />
      ) : (
        <SalesMetricsView salesService={salesService} dateFrom={dateFrom} dateTo={dateTo} />
      )}
    </div>
  );
}
