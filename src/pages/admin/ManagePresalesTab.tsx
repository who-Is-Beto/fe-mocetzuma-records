import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AdminPresale } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { useAuth } from "../../app/providers/AuthProvider";
import { createPresaleService } from "../../app/services/presaleService";
import { Img } from "../../components/Img";
import { ListSkeleton } from "../../components/Skeleton";
import { DeliverByCode } from "./presales/DeliverByCode";
import { PresaleDetail } from "./presales/PresaleDetail";
import { PresaleForm } from "./presales/PresaleForm";
import { btnPrimary, errorBox, label, panel, PRESALE_STATUS } from "./presales/ui";

/**
 * Administración → Preventas. URL-driven like the rest of the page:
 *   ?tab=presales&presale=<id>   one presale (buyers, payments, arrival)
 *   ?tab=presales&new=1          new presale form
 *   ?tab=presales&code=PV-XXXX   open an order by its code (the QR lands here)
 */
export function ManagePresalesTab() {
  const { token, hasPerm, role } = useAuth();
  const can = useCallback((perm: string) => role === "ADMIN" || hasPerm(`apiApp.${perm}`), [hasPerm, role]);
  const service = useMemo(() => createPresaleService({ getToken: () => token ?? null }), [token]);
  const [params, setParams] = useSearchParams();
  const [presales, setPresales] = useState<AdminPresale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedId = Number(params.get("presale")) || null;
  const creating = params.get("new") === "1";
  const code = params.get("code");

  const go = (next: Record<string, string>) => setParams(new URLSearchParams({ tab: "presales", ...next }));

  const load = useCallback(async () => {
    setError("");
    try {
      setPresales(await service.admin.list());
    } catch (err) {
      setError(extractErrorMessage(err, "No pudimos cargar las preventas."));
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void load();
  }, [load]);

  if (creating) {
    return (
      <PresaleForm
        service={service}
        onCancel={() => go({})}
        onSaved={(presale) => {
          void load();
          go({ presale: String(presale.id) });
        }}
      />
    );
  }

  if (selectedId) {
    return (
      <PresaleDetail
        service={service}
        presaleId={selectedId}
        can={can}
        onBack={() => {
          void load();
          go({});
        }}
        onDeleted={() => {
          void load();
          go({});
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <DeliverByCode service={service} can={can} initialCode={code} onClose={() => go({})} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy/70">
          Cada preventa con sus versiones, compradores, pagos y entregas.
        </p>
        {can("add_presale") && (
          <button type="button" className={btnPrimary} onClick={() => go({ new: "1" })}>
            Nueva preventa
          </button>
        )}
      </div>

      {error && <div role="alert" className={errorBox}>{error}</div>}

      {loading ? (
        <ListSkeleton rows={3} label="Cargando preventas…" />
      ) : presales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy/20 bg-cream/60 px-6 py-12 text-center">
          <p className="text-3xl" aria-hidden="true">📀</p>
          <p className="mt-2 text-sm text-navy/70">Todavía no hay preventas. Crea la primera y publícala cuando esté lista.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {presales.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => go({ presale: String(p.id) })}
                className={`${panel} group grid w-full gap-4 text-left transition hover:-translate-y-0.5 hover:shadow-panel sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center`}
              >
                <span className="hidden h-16 w-16 overflow-hidden rounded-xl bg-sand ring-1 ring-navy/10 sm:block">
                  {p.cover_url ? <Img src={p.cover_url} alt="" width={64} className="h-full w-full object-cover" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-[15px] text-denim group-hover:text-orange">{p.title}</span>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold ${
                        p.status === "published" ? "bg-green-100 text-green-900" : p.status === "draft" ? "bg-sun/60 text-navy" : "bg-navy/10 text-navy/70"
                      }`}
                    >
                      {PRESALE_STATUS[p.status]}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-navy/70">
                    {p.artist} · {p.options.length} {p.options.length === 1 ? "versión" : "versiones"} · cierra {p.purchase_deadline}
                  </span>
                </span>
                <dl className="grid grid-cols-3 gap-4 text-right text-sm sm:min-w-[19rem]">
                  <div>
                    <dt className={label}>Apartadas</dt>
                    <dd className="font-semibold tabular-nums text-navy">
                      {p.stats.reserved}/{p.stats.copies}
                    </dd>
                  </div>
                  <div>
                    <dt className={label}>Cobrado</dt>
                    <dd className="font-semibold tabular-nums text-navy">{currency(p.stats.collected)}</dd>
                  </div>
                  <div>
                    <dt className={label}>Por cobrar</dt>
                    <dd className="font-semibold tabular-nums text-coral">{currency(p.stats.owed)}</dd>
                  </div>
                </dl>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
