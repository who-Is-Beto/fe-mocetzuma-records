import { useCallback, useEffect, useId, useState } from "react";
import type { AdminPresale, AdminPresaleOrder, PresaleOrderFilter, PresaleTotals } from "../../../app/domain/presales";
import { currency } from "../../../app/lib/format";
import { extractErrorMessage } from "../../../app/lib/httpClient";
import type { PresaleService } from "../../../app/services/presaleService";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Img } from "../../../components/Img";
import { Modal } from "../../../components/Modal";
import { ListSkeleton } from "../../../components/Skeleton";
import { PresaleForm } from "./PresaleForm";
import { PresaleOrderPanel } from "./PresaleOrderPanel";
import { RegisterPresaleOrder } from "./RegisterPresaleOrder";
import { btnGhost, btnNavy, btnPrimary, errorBox, input, label, panel, PRESALE_STATUS, STATUS_TONE } from "./ui";

const FILTERS: { id: PresaleOrderFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "owes", label: "Deben dinero" },
  { id: "ready", label: "Listos para entregar" },
  { id: "expiring", label: "Por vencer" },
  { id: "expired", label: "Vencidos" }
];

type Props = {
  service: PresaleService;
  presaleId: number;
  can: (perm: string) => boolean;
  onBack: () => void;
  onDeleted: () => void;
};

type Confirm =
  | { kind: "arrived"; optionId: number | null; name: string; missing?: number }
  | { kind: "close" }
  | { kind: "delete" }
  | null;

/** One presale: totals, versions (arrival), buyers with filters, and every action on them. */
export function PresaleDetail({ service, presaleId, can, onBack, onDeleted }: Props) {
  const ids = useId();
  const [presale, setPresale] = useState<AdminPresale | null>(null);
  const [orders, setOrders] = useState<AdminPresaleOrder[]>([]);
  const [totals, setTotals] = useState<PresaleTotals | null>(null);
  const [filter, setFilter] = useState<PresaleOrderFilter>("all");
  const [arriving, setArriving] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [openOrder, setOpenOrder] = useState<AdminPresaleOrder | null>(null);
  const [registering, setRegistering] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [publishInfo, setPublishInfo] = useState<{ recipients: number; announced: boolean } | null>(null);
  const [announce, setAnnounce] = useState(true);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendTo, setExtendTo] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [p, o] = await Promise.all([service.admin.get(presaleId), service.admin.orders(presaleId, filter)]);
      setPresale(p);
      setOrders(o.orders);
      setTotals(o.totals);
    } catch (err) {
      setError(extractErrorMessage(err, "No pudimos cargar la preventa."));
    } finally {
      setLoading(false);
    }
  }, [service, presaleId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setConfirm(null);
      setPublishInfo(null);
      setExtendOpen(false);
      if (done) setNotice(done);
      await load();
    } catch (err) {
      setActionError(extractErrorMessage(err, "No se pudo completar la acción."));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !presale) return <ListSkeleton rows={4} label="Cargando preventa…" />;
  if (!presale) return <div role="alert" className={errorBox}>{error || "No encontramos esa preventa."}</div>;

  if (editing) {
    return (
      <PresaleForm
        service={service}
        presale={presale}
        onCancel={() => setEditing(false)}
        onSaved={(p) => {
          setPresale(p);
          setEditing(false);
          void load();
        }}
      />
    );
  }

  const canEdit = can("change_presale");
  const canPublish = can("publish_presale");
  const canArrive = can("change_presaleoption");
  const canDelete = can("delete_presale");
  const pending = presale.options.filter((o) => !o.arrived_at && o.is_active);

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="min-h-[44px] text-sm font-semibold text-navy hover:text-orange">
        ← Todas las preventas
      </button>

      <header className={`${panel} grid gap-4 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-center`}>
        <div className="h-20 w-20 overflow-hidden rounded-xl bg-sand ring-1 ring-navy/10">
          {presale.cover_url ? <Img src={presale.cover_url} alt="" width={80} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl text-denim">{presale.title}</h2>
            <span className="rounded-pill bg-sun/60 px-2 py-0.5 text-[11px] font-semibold text-navy">{PRESALE_STATUS[presale.status]}</span>
          </div>
          <p className="text-sm text-navy/70">
            {presale.artist} · apartan hasta el {presale.purchase_deadline}
            {presale.estimated_arrival ? ` · llega aprox. ${presale.estimated_arrival}` : ""}
            {presale.announced_at ? " · anunciada por correo" : ""}
          </p>
          {(canEdit || canPublish || canArrive || canDelete || can("change_presaleorder")) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {canPublish && presale.status !== "published" && (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={async () => {
                    const info = await service.admin.publishPreview(presale.id).catch(() => ({ recipients: 0, announced_at: null }));
                    setAnnounce(!info.announced_at);
                    setPublishInfo({ recipients: info.recipients, announced: Boolean(info.announced_at) });
                  }}
                >
                  Publicar preventa
                </button>
              )}
              {canEdit && (
                <button type="button" className={btnGhost} onClick={() => setEditing(true)}>
                  Editar
                </button>
              )}
              {canEdit && presale.status === "published" && (
                <button type="button" className={btnGhost} onClick={() => setConfirm({ kind: "close" })}>
                  Cerrar preventa
                </button>
              )}
              {canArrive && pending.length > 0 && presale.status !== "draft" && (
                <button type="button" className={btnNavy} onClick={() => setConfirm({ kind: "arrived", optionId: null, name: "todas las versiones" })}>
                  Llegó a tienda
                </button>
              )}
              {can("change_presaleorder") && (
                <button type="button" className={btnGhost} onClick={() => setExtendOpen(true)}>
                  Extender plazo
                </button>
              )}
              {canDelete && (totals?.reserved ?? 0) === 0 && (totals?.expired ?? 0) === 0 && (
                <button type="button" className="min-h-[44px] px-3 text-sm font-semibold text-coral hover:underline" onClick={() => setConfirm({ kind: "delete" })}>
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {notice && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-900">
          {notice}
        </p>
      )}

      {totals && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { k: "Apartadas", v: `${totals.reserved} de ${totals.copies}` },
            { k: "Pagadas completas", v: String(totals.paid_full) },
            { k: "Cobrado", v: currency(totals.collected) },
            { k: "Por cobrar", v: currency(totals.owed), tone: "text-coral" },
            { k: "Vencidas", v: String(totals.expired) }
          ].map((t) => (
            <div key={t.k} className={panel}>
              <dt className={label}>{t.k}</dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${t.tone ?? "text-navy"}`}>{t.v}</dd>
            </div>
          ))}
        </dl>
      )}

      <section aria-labelledby={`${ids}-options`} className={panel}>
        <h3 id={`${ids}-options`} className="font-semibold text-denim">Versiones</h3>
        <ul className="mt-3 divide-y divide-navy/10">
          {presale.options.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className={`font-semibold ${o.is_active ? "text-navy" : "text-navy/50"}`}>
                  {o.name} {!o.is_active && <span className="text-xs font-normal">(oculta)</span>}
                </p>
                {(o.description || o.items_inside > 1) && (
                  <p className="text-xs text-navy/70">
                    {o.items_inside} {o.items_inside === 1 ? "pieza" : "piezas"}
                    {o.description ? ` · ${o.description}` : ""}
                  </p>
                )}
                <p className="text-xs text-navy/70">
                  {currency(o.price)} · apartado {currency(o.min_deposit)}
                  {Number(o.full_payment_discount) > 0 ? ` · −${currency(o.full_payment_discount)} pagando completo` : ""} · {o.taken} de {o.copies} apartadas
                </p>
              </div>
              {o.arrived_at ? (
                <span className="rounded-pill bg-green-100 px-3 py-1 text-xs font-semibold text-green-900">
                  En tienda desde {new Date(o.arrived_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {o.arrived_copies > 0 && (
                    <span className="rounded-pill bg-sun/60 px-3 py-1 text-xs font-semibold text-navy">
                      {o.arrived_copies} de {o.copies} en tienda
                    </span>
                  )}
                  {canArrive && presale.status !== "draft" ? (
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => {
                        setArriving(String(o.copies - o.arrived_copies));
                        setConfirm({ kind: "arrived", optionId: o.id, name: o.name, missing: o.copies - o.arrived_copies });
                      }}
                    >
                      Registrar llegada
                    </button>
                  ) : o.arrived_copies === 0 ? (
                    <span className="text-xs text-navy/60">Aún no llega</span>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={`${ids}-buyers`} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id={`${ids}-buyers`} className="font-semibold text-denim">Compradores</h3>
          {can("add_presalepayment") && presale.status !== "draft" && (
            <button type="button" className={btnPrimary} onClick={() => setRegistering(true)}>
              Registrar preventa
            </button>
          )}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filtrar compradores">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-[40px] shrink-0 rounded-pill border px-4 text-sm font-semibold transition ${
                filter === f.id ? "border-navy bg-navy text-cream" : "border-navy/15 bg-white text-navy hover:border-orange"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && <div role="alert" className={errorBox}>{error}</div>}
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-navy/20 bg-cream/60 px-6 py-8 text-center text-sm text-navy/70">
            {filter === "all" ? "Nadie ha apartado todavía." : "Nadie en este filtro."}
          </p>
        ) : (
          <ul className="grid gap-2">
            {orders.map((o) => {
              const owes = Number(o.balance) > 0;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setOpenOrder(o)}
                    className={`${panel} grid w-full gap-3 text-left transition hover:-translate-y-0.5 hover:shadow-panel md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center`}
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-navy">{o.buyer_name}</span>
                        {o.oversold && <span className="rounded-pill bg-coral px-2 py-0.5 text-[10px] font-bold text-white">Sobreventa</span>}
                      </span>
                      <span className="block truncate text-xs text-navy/70">
                        {o.code} · {o.source_label} · {o.buyer_phone || o.buyer_email || "sin contacto"}
                      </span>
                    </span>
                    <span className="text-sm text-navy/80">
                      {o.lines_label}
                      <span className="block text-xs text-navy/60">
                        {o.delivery_label}
                        {o.shipping_pending ? " · envío por cotizar" : o.shipping_cost ? ` · envío ${currency(o.shipping_cost)}` : ""}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums text-navy">
                      {currency(o.paid)} de {currency(o.total)}
                      <span className={`block text-xs ${owes ? "text-coral" : "text-green-800"}`}>
                        {owes ? `Falta ${currency(o.balance)}${o.all_arrived ? ` · ${o.days_left} días` : ""}` : "Pagado completo"}
                      </span>
                    </span>
                    <span className={`justify-self-start rounded-pill px-2.5 py-1 text-[11px] font-semibold md:justify-self-end ${STATUS_TONE[o.status]}`}>
                      {o.is_expirable ? "Venció el plazo" : o.status_label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {openOrder && (
        <PresaleOrderPanel
          service={service}
          order={openOrder}
          can={can}
          onClose={() => setOpenOrder(null)}
          onChanged={(o) => {
            setOpenOrder(o);
            void load();
          }}
        />
      )}

      {registering && (
        <RegisterPresaleOrder
          service={service}
          presale={presale}
          onClose={() => setRegistering(false)}
          onSaved={(o) => {
            setRegistering(false);
            setNotice(`Preventa ${o.code} registrada para ${o.buyer_name}.`);
            void load();
            setOpenOrder(o);
          }}
        />
      )}

      <ConfirmDialog
        open={confirm?.kind === "arrived"}
        title="¿Ya llegó a la tienda?"
        message={
          <>
            {confirm?.kind === "arrived" && confirm.optionId ? (
              <label className="mb-3 block">
                <span className={label}>¿Cuántas copias de {confirm.name} llegaron? (faltaban {confirm.missing})</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={confirm.missing}
                  className={input}
                  value={arriving}
                  onChange={(e) => setArriving(e.target.value.replace(/\D/g, ""))}
                />
              </label>
            ) : null}
            Las copias se reparten primero a quien pagó completo (por quién terminó de pagar antes) y luego por quién pagó primero.
            Escribiremos a cada comprador que reciba copia: a quien pagó, que pase o que va en camino; a quien debe, cuánto le falta.
          </>
        }
        confirmLabel={confirm?.kind === "arrived" && confirm.optionId ? `Registrar ${arriving || 0} copias` : "Sí, ya llegó"}
        busy={busy}
        error={actionError}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          confirm?.kind === "arrived" &&
          run(
            () =>
              confirm.optionId
                ? service.admin.arrivedOption(confirm.optionId, Math.min(Number(arriving) || 0, confirm.missing ?? 0))
                : service.admin.arrivedAll(presale.id),
            "Listo: avisamos a los compradores."
          )
        }
      />
      <ConfirmDialog
        open={confirm?.kind === "close"}
        title="¿Cerrar la preventa?"
        message="Deja de aparecer en el inicio y nadie más puede apartar. Los compradores actuales siguen igual."
        confirmLabel="Cerrar preventa"
        busy={busy}
        error={actionError}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => service.admin.update(presale.id, { status: "closed" }), "Preventa cerrada.")}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        title="¿Eliminar la preventa?"
        tone="danger"
        message="Se borra por completo. Solo se puede porque nadie ha apartado."
        confirmLabel="Eliminar"
        busy={busy}
        error={actionError}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await service.admin.remove(presale.id);
            onDeleted();
          } catch (err) {
            setActionError(extractErrorMessage(err, "No se pudo eliminar."));
            setBusy(false);
          }
        }}
      />

      <Modal open={publishInfo !== null} onClose={() => setPublishInfo(null)} dismissible={!busy} labelledBy={`${ids}-publish`}>
        <h3 id={`${ids}-publish`} className="font-display text-lg text-denim">Publicar preventa</h3>
        <p className="mt-3 text-sm text-navy/80">Aparecerá en el inicio y cualquiera con cuenta podrá apartar.</p>
        {publishInfo && !publishInfo.announced ? (
          <label className="mt-4 flex items-start gap-3 rounded-xl bg-cream p-3 text-sm text-navy">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-orange" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
            <span>
              Avisar por correo a <strong>{publishInfo.recipients}</strong> {publishInfo.recipients === 1 ? "suscriptor" : "suscriptores"}. Solo se
              puede anunciar una vez.
            </span>
          </label>
        ) : (
          <p className="mt-3 text-sm text-navy/70">Ya se anunció por correo; no se vuelve a enviar.</p>
        )}
        {actionError && <p role="alert" className="mt-3 text-sm text-coral">{actionError}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setPublishInfo(null)}>
            Cancelar
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy}
            onClick={() =>
              run(async () => {
                const res = await service.admin.publish(presale.id, announce && !publishInfo?.announced);
                setNotice(res.recipients ? `Publicada. Enviando aviso a ${res.recipients} suscriptores.` : "Preventa publicada.");
              })
            }
          >
            {busy ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </Modal>

      <Modal open={extendOpen} onClose={() => setExtendOpen(false)} dismissible={!busy} labelledBy={`${ids}-extend`}>
        <h3 id={`${ids}-extend`} className="font-display text-lg text-denim">Extender plazo para liquidar</h3>
        <p className="mt-2 text-sm text-navy/75">
          Aplica a todos los compradores con saldo de esta preventa. El plazo nunca baja: si alguien ya tiene una fecha posterior, la conserva.
        </p>
        <label className="mt-4 block">
          <span className={label}>Nueva fecha límite</span>
          <input type="date" className={input} value={extendTo} onChange={(e) => setExtendTo(e.target.value)} />
        </label>
        {actionError && <p role="alert" className="mt-3 text-sm text-coral">{actionError}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setExtendOpen(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!extendTo || busy}
            onClick={() => run(() => service.admin.extend(presale.id, extendTo), "Plazo extendido.")}
          >
            Extender
          </button>
        </div>
      </Modal>
    </div>
  );
}
