import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { useServiceQuery } from "../../app/hooks/useServiceQuery";
import { createRecordService } from "../../app/services/recordService";
import { createSalesService } from "../../app/services/salesService";
import { storeDay } from "../../app/lib/format";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { normName } from "../../app/lib/text";
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

  /* ── Exportar CSV: every sold line of the range (point of sale + online) ── */
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  // The owner filter only shows (and applies) in Registro.
  const exportOwnerId = view === "history" ? ownerId : "";
  const exportOwner = (owners.data ?? []).find((o) => String(o.id) === exportOwnerId);

  const exportCsv = async () => {
    setExporting(true);
    setExportNote(null);
    try {
      const csv = await salesService.exportCsv({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        owner: exportOwnerId || undefined
      });
      const rows = csv.trim().split(/\r?\n/).length - 1; // minus the header
      if (rows <= 0) {
        setExportNote({ tone: "info", text: "No hay ventas en este periodo para exportar." });
        return;
      }
      // fetch's text() drops the BOM: put it back so Excel reads the accents as UTF-8.
      const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = [
        "ventas",
        dateFrom || "inicio",
        dateTo || storeDay(new Date()),
        exportOwner && normName(exportOwner.name).replace(/\s+/g, "-")
      ]
        .filter(Boolean)
        .join("_") + ".csv";
      link.click();
      URL.revokeObjectURL(url);
      setExportNote({
        tone: "info",
        text: `CSV descargado: ${rows} ${rows === 1 ? "renglón" : "renglones"} (uno por disco vendido)${
          exportOwner ? ` de ${exportOwner.name}` : ""
        }.`
      });
    } catch (err) {
      setExportNote({ tone: "error", text: extractErrorMessage(err, "No se pudo exportar el CSV.") });
    } finally {
      setExporting(false);
    }
  };

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

      {/* ── Filters + export ── */}
      <div
        className={`mt-4 grid grid-cols-1 gap-2 ${
          view === "history" ? "sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]" : "sm:grid-cols-[1fr_1fr_auto]"
        }`}
      >
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
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={exporting}
          title="Cada disco vendido en una fila: punto de venta y compras en línea, con dueño, costo y ganancia."
          className={`flex min-h-[46px] items-center justify-center gap-2 self-end rounded-xl border border-denim/20 bg-white px-4 text-sm font-semibold text-denim shadow-sm transition hover:border-orange hover:text-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 disabled:cursor-wait disabled:opacity-60 ${
            view === "history" ? "sm:col-span-3 lg:col-span-1" : ""
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-4 w-4 ${exporting ? "animate-bounce" : ""}`}>
            <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
          </svg>
          {exporting ? "Generando…" : exportOwner ? `Exportar CSV de ${exportOwner.name}` : "Exportar CSV"}
        </button>
      </div>
      {exportNote && (
        <p
          role={exportNote.tone === "error" ? "alert" : "status"}
          className={`mt-2 rounded-xl border px-4 py-2 text-xs ${
            exportNote.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {exportNote.text}
        </p>
      )}

      {view === "history" ? (
        <SalesHistory salesService={salesService} dateFrom={dateFrom} dateTo={dateTo} ownerId={ownerId} />
      ) : (
        <SalesMetricsView salesService={salesService} dateFrom={dateFrom} dateTo={dateTo} />
      )}
    </div>
  );
}
