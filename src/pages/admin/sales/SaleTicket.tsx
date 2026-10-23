import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "../../../components/Modal";
import { Img } from "../../../components/Img";
import { extractErrorMessage } from "../../../app/lib/httpClient";
import { currency } from "../../../app/lib/format";
import type { Owner, Record as AlbumRecord, RecordRepository } from "../../../app/domain/album";
import {
  DEFAULT_CARD_COMMISSION_RATE,
  PAYMENT_METHOD_LABELS,
  commissionCents,
  toCents,
  type PaymentMethod,
  type Sale,
  type SaleResult
} from "../../../app/domain/sales";
import type { SellLine, SellPayment } from "../../../app/hooks/useAdminRecords";
import { QuantityStepper } from "./QuantityStepper";
import { isSplit, subtotalCents, unitPrice, type TicketLine } from "./ticket";

const PAYMENT_OPTIONS: { method: PaymentMethod; icon: string }[] = [
  { method: "cash", icon: "💵" },
  { method: "card", icon: "💳" },
  { method: "transfer", icon: "🏦" }
];

/** 0–100 with at most two decimals, like the backend's commission_rate field. */
const isValidRate = (rate: string) => /^\d{1,3}(\.\d{1,2})?$/.test(rate.trim()) && Number(rate) <= 100;
const isValidMoney = (value: string) => /^\d+([.,]\d{1,2})?$/.test(value.trim());

const needsOwner = (line: TicketLine) => line.owners !== null && line.owners.length === 0;
const needsCost = (line: TicketLine) => line.cost !== null && !(Number(line.cost) > 0);

const artistName = (record: AlbumRecord) =>
  typeof record.artist === "object" && record.artist ? record.artist.name : "";

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30 disabled:opacity-50";

/** Owner <select> value that opens the inline "new owner" fields. */
const NEW_OWNER = "__new__";

/* What the admin fills in the "Antes de vender" step, per record id. */
type Details = { [recordId: string]: { owner: string; cost: string } };

type Props = {
  open: boolean;
  lines: TicketLine[];
  onUpdateLine: (id: AlbumRecord["id"], changes: Partial<TicketLine>) => void;
  onRemoveLine: (id: AlbumRecord["id"]) => void;
  /** Close the sheet to pick another record; the ticket is kept. */
  onAddMore: () => void;
  /** Close keeping the ticket (overlay, Escape, ✕). */
  onClose: () => void;
  /** Empty the ticket: discarded, or done after the sale was registered. */
  onReset: () => void;
  sell: (lines: SellLine[], payment: SellPayment) => Promise<SaleResult>;
  recordService: RecordRepository;
};

/**
 * Punto de venta ticket: a bottom sheet on phones (dialog from `sm`) whose
 * total and "Confirmar venta" stay pinned at the bottom however long the
 * ticket gets. Records without owner or cost get an optional "Antes de
 * vender" step that saves them on the record before the sale.
 */
export function SaleTicket({
  open,
  lines,
  onUpdateLine,
  onRemoveLine,
  onAddMore,
  onClose,
  onReset,
  sell,
  recordService
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [commissionRate, setCommissionRate] = useState(DEFAULT_CARD_COMMISSION_RATE);
  const [step, setStep] = useState<"ticket" | "details">("ticket");
  // Asked once per ticket: after "Omitir" or saving, confirming sells directly.
  const [detailsReviewed, setDetailsReviewed] = useState(false);
  const [details, setDetails] = useState<Details>({});
  const [owners, setOwners] = useState<Owner[] | null>(null);
  const [newOwner, setNewOwner] = useState<{ recordId: string; name: string; email: string } | null>(null);
  const [busy, setBusy] = useState<"saving" | "selling" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sold, setSold] = useState<{ sale: Sale; warnings: string[] } | null>(null);

  const subtotal = subtotalCents(lines);
  const rateValid = isValidRate(commissionRate);
  const fee = paymentMethod === "card" && rateValid ? commissionCents(subtotal, commissionRate) : 0;
  const total = subtotal - fee;
  const loadingLines = lines.some((l) => l.owners === null || l.cost === null);
  const missingSplit = lines.some((l) => l.quantity <= 0);
  const canConfirm =
    paymentMethod !== null && (paymentMethod !== "card" || rateValid) && !loadingLines && !missingSplit;
  const incomplete = lines.filter((l) => needsOwner(l) || needsCost(l));
  const blockReason = loadingLines
    ? "Cargando datos de los discos…"
    : missingSplit
    ? "Indica cuántos vendes de cada dueño."
    : paymentMethod === null
    ? "Elige la forma de pago."
    : paymentMethod === "card" && !rateValid
    ? "Revisa la comisión de la tarjeta."
    : null;
  const working = busy !== null;
  const units = lines.reduce((sum, l) => sum + l.quantity, 0);

  // Each step starts at its top (the sheet keeps its scroll otherwise).
  const view = sold ? "sold" : step;
  useEffect(() => {
    document.getElementById("sale-ticket-title")?.scrollIntoView({ block: "nearest" });
  }, [view]);

  const registerSale = async () => {
    if (!paymentMethod) return;
    setBusy("selling");
    setError(null);
    try {
      const result = await sell(
        // A split line goes out as one sale line per owner.
        lines.flatMap((l) => {
          const price = l.price.trim() || undefined;
          if (!isSplit(l)) return [{ record: l.record, quantity: l.quantity, price }];
          return Object.entries(l.split)
            .filter(([, quantity]) => quantity > 0)
            .map(([owner, quantity]) => ({ record: l.record, quantity, price, owner: Number(owner) }));
        }),
        {
          payment_method: paymentMethod,
          commission_rate: paymentMethod === "card" ? commissionRate.trim() : undefined
        }
      );
      setSold({ sale: result.sale, warnings: result.warnings });
      setStep("ticket");
    } catch (err) {
      setError(extractErrorMessage(err, "Error al registrar la venta."));
    } finally {
      setBusy(null);
    }
  };

  const confirm = () => {
    if (!canConfirm || working) return;
    if (incomplete.length > 0 && !detailsReviewed) {
      setError(null);
      setStep("details");
      if (owners === null && incomplete.some(needsOwner)) {
        recordService.getOwners().then(setOwners, () => setOwners([]));
      }
      return;
    }
    void registerSale();
  };

  const detailFor = (line: TicketLine) => details[String(line.record.id)] ?? { owner: "", cost: "" };
  const setDetail = (line: TicketLine, changes: Partial<{ owner: string; cost: string }>) =>
    setDetails((prev) => ({ ...prev, [String(line.record.id)]: { ...detailFor(line), ...changes } }));
  const filled = incomplete.filter((l) => {
    const d = detailFor(l);
    return (needsOwner(l) && d.owner) || (needsCost(l) && d.cost.trim());
  });
  const invalidCost = incomplete.some((l) => {
    const cost = detailFor(l).cost.trim();
    return needsCost(l) && cost !== "" && !isValidMoney(cost);
  });

  const saveNewOwner = async () => {
    if (!newOwner) return;
    const name = newOwner.name.trim();
    const email = newOwner.email.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Escribe el nombre y un correo válido del nuevo dueño.");
      return;
    }
    setBusy("saving");
    setError(null);
    try {
      const owner = await recordService.createOwner({ name, email });
      setOwners((prev) => [...(prev ?? []), owner].sort((a, b) => a.name.localeCompare(b.name)));
      setDetails((prev) => ({
        ...prev,
        [newOwner.recordId]: { ...(prev[newOwner.recordId] ?? { cost: "" }), owner: String(owner.id) }
      }));
      setNewOwner(null);
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudo crear el dueño."));
    } finally {
      setBusy(null);
    }
  };

  /** Save owner/cost on each record, then register the sale (its lines keep the cost). */
  const saveDetailsAndSell = async () => {
    if (newOwner) {
      setError("Guarda o cancela el nuevo dueño primero.");
      return;
    }
    setBusy("saving");
    setError(null);
    try {
      for (const line of filled) {
        const d = detailFor(line);
        const full = await recordService.update(line.record.id, {
          ...(needsOwner(line) && d.owner ? { owners: [{ owner: Number(d.owner) }] } : {}),
          ...(needsCost(line) && d.cost.trim() ? { cost_price: Number(d.cost.replace(",", ".")) } : {})
        });
        onUpdateLine(line.record.id, {
          owners: (full.owners ?? []).filter((o) => o.quantity > 0),
          cost: String(full.cost_price ?? "0")
        });
      }
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudieron guardar los datos del disco."));
      setBusy(null);
      return;
    }
    setDetailsReviewed(true);
    await registerSale();
  };

  const skipDetails = () => {
    setDetailsReviewed(true);
    void registerSale();
  };

  const close = () => {
    if (working) return;
    if (sold) onReset();
    else onClose();
  };

  /* ── Pieces ── */

  const header = (title: string, subtitle: string) => (
    <div className="flex items-start justify-between gap-3 pb-3 pt-1 sm:pt-0">
      <div className="min-w-0">
        <h3 id="sale-ticket-title" className="font-display text-lg text-denim">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-navy/60">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={close}
        disabled={working}
        aria-label={sold ? "Cerrar" : "Cerrar (la venta se conserva)"}
        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-navy/60 transition hover:bg-navy/5 hover:text-navy disabled:opacity-40"
      >
        ✕
      </button>
    </div>
  );

  const errorBox = error && (
    <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
      {error}
    </div>
  );

  /** Sticky footer: content scrolls under it, the main action is always reachable. */
  const footer = (children: ReactNode) => (
    // Negative bottom/margin = the panel's bottom padding: sticky measures from inside it.
    <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 mt-4 border-t border-navy/10 bg-sand/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:rounded-b-2xl sm:px-6 sm:pb-5">
      {children}
    </div>
  );

  const cover = (record: AlbumRecord, size: string) =>
    record.cover_image_url ? (
      <Img src={record.cover_image_url} alt="" width={56} className={`${size} shrink-0 rounded-lg object-cover`} />
    ) : (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-navy/5 text-sm`}>🎵</div>
    );

  /* ── Success ── */

  if (sold) {
    return (
      <Modal open={open} onClose={close} labelledBy="sale-ticket-title" variant="sheet">
        {header("Venta registrada", `Venta #${sold.sale.id}`)}
        <div className="flex flex-col items-center rounded-2xl border border-green-200 bg-green-50 px-4 py-6 text-center">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-2xl text-white shadow-panel animate-modal-in"
          >
            ✓
          </span>
          <p className="mt-3 text-sm text-green-800">
            {sold.sale.items.reduce((sum, i) => sum + i.quantity, 0)}{" "}
            {sold.sale.items.reduce((sum, i) => sum + i.quantity, 0) === 1 ? "disco" : "discos"} ·{" "}
            {PAYMENT_METHOD_LABELS[sold.sale.payment_method]}
          </p>
          <p className="mt-1 font-display text-2xl text-denim">{currency(sold.sale.final_sale_price)}</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-green-800/70">Total final</p>
        </div>
        {sold.warnings.length > 0 && (
          <ul role="status" className="mt-3 space-y-1 rounded-xl border border-orange/40 bg-sun/30 px-4 py-3 text-xs text-navy">
            {sold.warnings.map((w) => (
              <li key={w}>⚠️ {w}</li>
            ))}
          </ul>
        )}
        {footer(
          <button
            type="button"
            onClick={onReset}
            className="min-h-[48px] w-full rounded-pill bg-orange px-5 text-sm font-semibold text-charcoal shadow-panel transition hover:bg-amber"
          >
            Nueva venta
          </button>
        )}
      </Modal>
    );
  }

  /* ── "Antes de vender": optional owner / cost ── */

  if (step === "details") {
    return (
      <Modal open={open} onClose={close} dismissible={!working} labelledBy="sale-ticket-title" variant="sheet">
        {header(
          "Antes de vender",
          "Opcional: con dueño y costo cada venta queda ligada a su dueño y la ganancia sale exacta."
        )}
        <ul className="space-y-3">
          {incomplete.map((line) => {
            const d = detailFor(line);
            const id = String(line.record.id);
            const costInvalid = d.cost.trim() !== "" && !isValidMoney(d.cost);
            return (
              <li key={id} className="rounded-xl border border-navy/10 bg-white/70 p-3">
                <div className="flex items-center gap-3">
                  {cover(line.record, "h-11 w-11")}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{line.record.title}</p>
                    <p className="truncate text-[11px] text-navy/60">
                      {[artistName(line.record), line.record.condition].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>

                {needsOwner(line) && (
                  <div className="mt-3">
                    <label htmlFor={`owner-${id}`} className="text-[11px] font-semibold text-navy/60">
                      Dueño <span className="font-normal text-navy/40">· sin dueño</span>
                    </label>
                    {newOwner?.recordId === id ? (
                      <div className="mt-1 space-y-2 rounded-xl border border-orange/40 bg-sun/20 p-2.5">
                        <input
                          autoFocus
                          value={newOwner.name}
                          onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })}
                          placeholder="Nombre"
                          aria-label="Nombre del nuevo dueño"
                          className={inputClass}
                        />
                        <input
                          type="email"
                          inputMode="email"
                          value={newOwner.email}
                          onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })}
                          placeholder="correo@ejemplo.com"
                          aria-label="Correo del nuevo dueño"
                          className={inputClass}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setNewOwner(null)}
                            className="min-h-[40px] rounded-full px-3 text-xs font-semibold text-navy/70 hover:bg-navy/5"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveNewOwner()}
                            disabled={working}
                            className="min-h-[40px] rounded-full bg-navy px-4 text-xs font-semibold text-cream transition hover:bg-denim disabled:opacity-50"
                          >
                            {busy === "saving" ? "Guardando…" : "Guardar dueño"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <select
                        id={`owner-${id}`}
                        value={d.owner}
                        disabled={working || owners === null}
                        onChange={(e) =>
                          e.target.value === NEW_OWNER
                            ? setNewOwner({ recordId: id, name: "", email: "" })
                            : setDetail(line, { owner: e.target.value })
                        }
                        className={`mt-1 ${inputClass}`}
                      >
                        <option value="">{owners === null ? "Cargando dueños…" : "Sin dueño (de la tienda)"}</option>
                        {(owners ?? []).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                        <option value={NEW_OWNER}>+ Agregar nuevo dueño…</option>
                      </select>
                    )}
                    {d.owner && (
                      <p className="mt-1 text-[11px] text-navy/50">
                        {line.record.stock === 1
                          ? "El disco en stock quedará a su nombre."
                          : `Los ${line.record.stock} discos en stock quedarán a su nombre.`}{" "}
                        Recibirá el correo de esta venta.
                      </p>
                    )}
                  </div>
                )}

                {needsCost(line) && (
                  <div className="mt-3">
                    <label htmlFor={`cost-${id}`} className="text-[11px] font-semibold text-navy/60">
                      Precio de costo por disco <span className="font-normal text-navy/40">· sin costo</span>
                    </label>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy/40">
                        $
                      </span>
                      <input
                        id={`cost-${id}`}
                        type="text"
                        inputMode="decimal"
                        value={d.cost}
                        disabled={working}
                        onChange={(e) => setDetail(line, { cost: e.target.value })}
                        placeholder="0.00"
                        aria-invalid={costInvalid}
                        className={`${inputClass} pl-7 ${costInvalid ? "border-coral" : ""}`}
                      />
                    </div>
                    {costInvalid ? (
                      <p className="mt-1 text-[11px] text-coral">Usa un monto como 150 o 150.50.</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-navy/50">Se guarda en el disco para medir la ganancia.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {errorBox}
        {footer(
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void saveDetailsAndSell()}
              disabled={working || filled.length === 0 || invalidCost}
              className="min-h-[48px] w-full rounded-pill bg-orange px-5 text-sm font-semibold text-charcoal shadow-panel transition hover:bg-amber disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "saving"
                ? "Guardando…"
                : busy === "selling"
                ? "Registrando venta…"
                : `Guardar y vender · ${currency(total / 100)}`}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep("ticket");
                }}
                disabled={working}
                className="min-h-[44px] flex-1 rounded-full border border-navy/15 bg-white px-3 text-xs font-semibold text-navy transition hover:bg-navy/5 disabled:opacity-50"
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={skipDetails}
                disabled={working}
                className="min-h-[44px] flex-1 rounded-full border border-navy/15 bg-white px-3 text-xs font-semibold text-navy transition hover:bg-navy/5 disabled:opacity-50"
              >
                Vender sin agregar
              </button>
            </div>
          </div>
        )}
      </Modal>
    );
  }

  /* ── Ticket ── */

  return (
    <Modal open={open} onClose={close} dismissible={!working} labelledBy="sale-ticket-title" variant="sheet">
      {header(
        "Registrar venta",
        `${lines.length} ${lines.length === 1 ? "disco" : "discos"} · Cada dueño recibe un correo solo con los suyos.`
      )}

      <ul className="space-y-3">
        {lines.map((line) => {
          const stock = line.record.stock ?? 0;
          const id = String(line.record.id);
          return (
            <li key={id} className="rounded-xl border border-navy/10 bg-white/70 p-3">
              <div className="flex items-start gap-3">
                {cover(line.record, "h-12 w-12")}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-navy">{line.record.title}</p>
                  <p className="line-clamp-2 text-[11px] text-navy/60">
                    {[
                      artistName(line.record),
                      line.record.condition,
                      line.owners?.length === 1 ? `Dueño: ${line.owners[0].owner_name}` : null,
                      `${stock} en stock`
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveLine(line.record.id)}
                  disabled={working}
                  aria-label={`Quitar ${line.record.title} de la venta`}
                  className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm text-coral transition hover:bg-coral/10 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                {!isSplit(line) && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-navy/60">Cantidad</p>
                    <QuantityStepper
                      value={line.quantity}
                      min={1}
                      max={stock}
                      onChange={(quantity) => onUpdateLine(line.record.id, { quantity })}
                      label={`Cantidad de ${line.record.title}`}
                      disabled={working || line.owners === null}
                    />
                  </div>
                )}
                <label className="min-w-[8rem] flex-1 text-[11px] font-semibold text-navy/60">
                  Precio unitario
                  <span className="relative mt-1 block">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-normal text-navy/40">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={line.price}
                      disabled={working}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => onUpdateLine(line.record.id, { price: e.target.value })}
                      className={`${inputClass} h-11 pl-7`}
                    />
                  </span>
                </label>
              </div>

              {line.owners === null && (
                <p className="mt-2 text-[11px] text-navy/50 animate-pulse">Cargando dueños…</p>
              )}
              {/* Several owners have it: how many of whose, like the record form */}
              {line.owners && isSplit(line) && (
                <fieldset className="mt-3 rounded-xl border border-navy/10 bg-cream/60 p-2.5">
                  <legend className="px-1 text-[11px] font-semibold text-navy/60">
                    ¿De quién son los que vendes? <span className="text-coral">*</span>
                  </legend>
                  <ul className="space-y-2">
                    {line.owners.map((o) => (
                      <li key={o.owner} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm text-navy">
                          {o.owner_name}{" "}
                          <span className="text-[11px] text-navy/50">({o.quantity} en stock)</span>
                        </span>
                        <QuantityStepper
                          value={line.split[o.owner] ?? 0}
                          min={0}
                          max={o.quantity}
                          label={`Cantidad de ${o.owner_name}`}
                          disabled={working}
                          onChange={(n) => {
                            const split: TicketLine["split"] = { ...line.split, [o.owner]: n };
                            const quantity = Object.values(split).reduce((sum, q) => sum + q, 0);
                            onUpdateLine(line.record.id, { split, quantity });
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                  {line.quantity === 0 && (
                    <p className="mt-2 text-[11px] font-semibold text-coral">Indica cuántos vendes de cada dueño.</p>
                  )}
                </fieldset>
              )}

              {line.quantity > 0 && (
                <p className="mt-2 text-right text-xs text-navy/60 tabular-nums">
                  {line.quantity} × {currency(unitPrice(line))} ={" "}
                  <span className="font-semibold text-navy">{currency((toCents(unitPrice(line)) * line.quantity) / 100)}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onAddMore}
        disabled={working}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-orange/50 bg-white/50 text-xs font-semibold text-orange transition hover:bg-orange/10 disabled:opacity-50"
      >
        + Agregar otro disco
      </button>

      {/* ── Payment method (required) + card commission ── */}
      <fieldset className="mt-4">
        <legend className="text-[11px] font-semibold text-navy/60">
          Forma de pago <span className="text-coral">*</span>
        </legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {PAYMENT_OPTIONS.map(({ method, icon }) => (
            <label
              key={method}
              className="flex min-h-[48px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-navy/15 bg-white px-2 text-xs font-semibold text-navy transition hover:border-orange has-[:checked]:border-orange has-[:checked]:bg-orange has-[:checked]:text-charcoal has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange/30 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            >
              <input
                type="radio"
                name="payment_method"
                value={method}
                checked={paymentMethod === method}
                onChange={() => setPaymentMethod(method)}
                disabled={working}
                className="sr-only"
              />
              <span aria-hidden="true">{icon}</span>
              {PAYMENT_METHOD_LABELS[method]}
            </label>
          ))}
        </div>
      </fieldset>

      {paymentMethod === "card" && (
        <>
          <label className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold text-navy/60">
            Comisión por tarjeta (%)
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              disabled={working}
              aria-invalid={!rateValid}
              className={`h-11 w-24 rounded-xl border bg-white px-3 text-right text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30 ${
                rateValid ? "border-navy/15" : "border-coral"
              }`}
            />
          </label>
          {!rateValid && (
            <p className="mt-1 text-right text-[11px] text-coral">Usa un porcentaje entre 0 y 100 (máx. 2 decimales).</p>
          )}
        </>
      )}

      <dl className="mt-4 space-y-1 rounded-xl border border-navy/10 bg-white/70 px-4 py-3 text-sm text-navy">
        <div className="flex justify-between">
          <dt className="text-navy/60">Subtotal ({units} {units === 1 ? "disco" : "discos"})</dt>
          <dd className="tabular-nums">{currency(subtotal / 100)}</dd>
        </div>
        {paymentMethod === "card" && (
          <div className="flex justify-between">
            <dt className="text-navy/60">Comisión tarjeta ({rateValid ? Number(commissionRate) : "—"}%)</dt>
            <dd className="tabular-nums text-coral">−{currency(fee / 100)}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        onClick={onReset}
        disabled={working}
        className="mx-auto mt-3 block min-h-[40px] px-3 text-xs font-semibold text-coral underline-offset-2 hover:underline disabled:opacity-50"
      >
        Descartar venta
      </button>

      {errorBox}

      {footer(
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy/50">Total final</p>
            <p className="font-display text-lg leading-tight text-denim tabular-nums">{currency(total / 100)}</p>
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={confirm}
              disabled={working || !canConfirm}
              aria-describedby={blockReason ? "sale-block-reason" : undefined}
              className="min-h-[48px] w-full rounded-pill bg-orange px-5 text-sm font-semibold text-charcoal shadow-panel transition hover:bg-amber disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "selling" ? "Registrando…" : "Confirmar venta"}
            </button>
            {blockReason && (
              <p id="sale-block-reason" className="mt-1 text-center text-[11px] text-navy/60">
                {blockReason}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
