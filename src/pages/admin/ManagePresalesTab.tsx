import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AdminPresale } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { useAuth } from "../../app/providers/AuthProvider";
import { createPresaleService } from "../../app/services/presaleService";
import { Img } from "../../components/Img";
import { Modal } from "../../components/Modal";
import { ListSkeleton } from "../../components/Skeleton";
import { DeliverByCode } from "./presales/DeliverByCode";
import { PresaleDetail } from "./presales/PresaleDetail";
import { PresaleForm } from "./presales/PresaleForm";
import { btnGhost, btnPrimary, errorBox, label, panel, PRESALE_STATUS } from "./presales/ui";

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
  const ids = useId();
  // "Publicar varias": drafts ticked here go live together with one email to subscribers.
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [recipients, setRecipients] = useState(0);
  const [announce, setAnnounce] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [notice, setNotice] = useState("");

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

  const drafts = presales.filter((p) => p.status === "draft");
  const chosen = presales.filter((p) => picked?.has(p.id));
  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openPublish = async () => {
    setPublishError("");
    const info = await service.admin.publishPreview(chosen[0].id).catch(() => ({ recipients: 0, announced_at: null }));
    setRecipients(info.recipients);
    setAnnounce(true);
    setPublishOpen(true);
  };
  const publishMany = async () => {
    setPublishing(true);
    setPublishError("");
    try {
      const res = await service.admin.publishMany(chosen.map((p) => p.id), announce);
      setNotice(
        `${res.published} preventas publicadas.` +
          (res.recipients ? ` Enviando un solo correo a ${res.recipients} suscriptores.` : "")
      );
      setPublishOpen(false);
      setPicked(null);
      await load();
    } catch (err) {
      setPublishError(extractErrorMessage(err, "No pudimos publicarlas."));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-5">
      <DeliverByCode service={service} can={can} initialCode={code} onClose={() => go({})} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy/70">
          Cada preventa con sus versiones, compradores, pagos y entregas.
        </p>
        <div className="flex flex-wrap gap-2">
          {can("publish_presale") && drafts.length > 1 && !picked && (
            <button type="button" className={btnGhost} onClick={() => setPicked(new Set())}>
              Publicar varias
            </button>
          )}
          {can("add_presale") && !picked && (
            <button type="button" className={btnPrimary} onClick={() => go({ new: "1" })}>
              Nueva preventa
            </button>
          )}
        </div>
      </div>

      {picked && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy px-4 py-3 text-cream shadow-panel">
          <p className="text-sm">
            {picked.size === 0
              ? "Marca los borradores que salen juntos."
              : `${picked.size} ${picked.size === 1 ? "preventa elegida" : "preventas elegidas"}: aparecen al mismo tiempo y los suscriptores reciben un solo correo.`}
          </p>
          <div className="flex gap-2">
            <button type="button" className="min-h-[44px] rounded-pill px-4 text-sm font-semibold text-cream/80 hover:text-cream" onClick={() => setPicked(null)}>
              Cancelar
            </button>
            <button type="button" className={btnPrimary} disabled={picked.size === 0} onClick={() => void openPublish()}>
              Publicar {picked.size || ""}
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-900">
          {notice}
        </p>
      )}

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
            <li key={p.id} className={picked && p.status !== "draft" ? "opacity-50" : ""}>
              <button
                type="button"
                role={picked ? "checkbox" : undefined}
                aria-checked={picked ? picked.has(p.id) : undefined}
                disabled={Boolean(picked) && p.status !== "draft"}
                onClick={() => (picked ? toggle(p.id) : go({ presale: String(p.id) }))}
                className={`${panel} group grid w-full gap-4 text-left transition hover:-translate-y-0.5 hover:shadow-panel disabled:cursor-not-allowed disabled:hover:translate-y-0 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center ${
                  picked?.has(p.id) ? "ring-2 ring-orange" : ""
                }`}
              >
                <span className="relative hidden h-16 w-16 overflow-hidden rounded-xl bg-sand ring-1 ring-navy/10 sm:block">
                  {p.cover_url ? <Img src={p.cover_url} alt="" width={64} className="h-full w-full object-cover" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    {picked && p.status === "draft" && (
                      <span
                        aria-hidden="true"
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold ${
                          picked.has(p.id) ? "border-orange bg-orange text-charcoal" : "border-navy/30 bg-white"
                        }`}
                      >
                        {picked.has(p.id) ? "✓" : ""}
                      </span>
                    )}
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
      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} dismissible={!publishing} labelledBy={`${ids}-publish`}>
        <h3 id={`${ids}-publish`} className="font-display text-lg text-denim">
          Publicar {chosen.length} preventas juntas
        </h3>
        <ul className="mt-3 space-y-2">
          {chosen.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-cream px-3 py-2">
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sand">
                {p.cover_url ? <Img src={p.cover_url} alt="" width={40} className="h-full w-full object-cover" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-navy">{p.title}</span>
                <span className="block truncate text-xs text-navy/70">{p.artist}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-navy/80">Aparecen en el inicio al mismo tiempo y cualquiera con cuenta puede apartar.</p>
        <label className="mt-4 flex items-start gap-3 rounded-xl bg-cream p-3 text-sm text-navy">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-orange" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
          <span>
            Avisar con <strong>un solo correo</strong> a {recipients} {recipients === 1 ? "suscriptor" : "suscriptores"}. Las que ya se
            anunciaron antes no se repiten.
          </span>
        </label>
        {publishError && <p role="alert" className="mt-3 text-sm text-coral">{publishError}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setPublishOpen(false)}>
            Cancelar
          </button>
          <button type="button" className={btnPrimary} disabled={publishing} onClick={() => void publishMany()}>
            {publishing ? "Publicando…" : `Publicar ${chosen.length}`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
