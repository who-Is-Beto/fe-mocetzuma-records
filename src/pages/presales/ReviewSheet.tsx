import { useId, useState } from "react";
import { Link } from "react-router-dom";
import type { Presale, PresaleDelivery, PresaleOption } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { Img } from "../../components/Img";
import { Modal } from "../../components/Modal";
import type { BagPresale } from "../../app/lib/presaleBag";
import type { ShippingAddressValues } from "../cart/ShippingAddressFields";

type Props = {
  open: boolean;
  presale: Pick<Presale, "title" | "artist" | "cover">;
  lines: { option: PresaleOption; quantity: number; presale?: BagPresale }[];
  delivery: PresaleDelivery;
  address: ShippingAddressValues;
  shippingEstimate: number | null;
  /** What Stripe charges now: records part + shipping when paid in full. */
  payNow: number;
  shippingNow: number;
  /** What's left on the records after today (0 when paid in full). */
  left: number;
  isFull: boolean;
  discount: number;
  /** "14 de marzo de 2027" */
  deadline: string;
  termsText: string;
  sending: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
};

const sectionTitle = "text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/60";

/**
 * "Revisa tu preventa": the last look before Stripe, like a delivery app's
 * order review. Everything the buyer agrees to on one sheet, and the terms
 * are accepted here, right next to the amount.
 */
export function ReviewSheet(props: Props) {
  const { open, presale, lines, delivery, address, shippingEstimate, payNow, shippingNow, left, isFull, discount, deadline } = props;
  const ids = useId();
  const [accepted, setAccepted] = useState(false);
  const copies = lines.reduce((n, l) => n + l.quantity, 0);
  // One order can hold several presales: the header names them all, each line says which.
  const presales = [...new Map(lines.map((l) => [l.presale?.slug ?? "", l.presale ?? presale])).values()];
  const multi = presales.length > 1;
  const heading = multi ? presales.map((p) => p.title).join(" + ") : presale.title;
  const artists = multi ? [...new Set(presales.map((p) => p.artist))].join(" · ") : presale.artist;
  const place = [`${address.street} ${address.number}`.trim(), address.neighborhood, `CP ${address.zip}`, address.city]
    .filter(Boolean)
    .join(", ");

  return (
    <Modal open={open} onClose={props.onClose} dismissible={!props.sending} labelledBy={`${ids}-title`} variant="sheet">
      <div className="max-h-[82vh] overflow-y-auto overscroll-contain pr-1">
        <div className="flex items-center gap-3">
          {presale.cover ? (
            <Img src={presale.cover} alt="" width={56} className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-navy/10" />
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange">
              {multi ? `Revisa tu pedido · ${presales.length} preventas` : "Revisa tu preventa"}
            </p>
            <h2 id={`${ids}-title`} className="truncate font-display text-lg leading-tight text-denim">
              {heading}
            </h2>
            <p className="truncate text-xs text-navy/70">{artists}</p>
          </div>
        </div>

        {/* What */}
        <section className="mt-5">
          <div className="flex items-baseline justify-between">
            <h3 className={sectionTitle}>{copies === 1 ? "Tu disco" : `Tus ${copies} discos`}</h3>
            <button type="button" onClick={props.onClose} className="min-h-[44px] text-sm font-semibold text-denim underline-offset-4 hover:text-orange hover:underline">
              Cambiar
            </button>
          </div>
          <ul className="divide-y divide-navy/10 rounded-2xl bg-white/80 px-3 ring-1 ring-navy/10">
            {lines.map(({ option, quantity, presale: linePresale }, i) => (
              <li
                key={option.id}
                style={{ animationDelay: `${80 + i * 60}ms` }}
                className="flex animate-toast-in items-center gap-3 py-2.5 motion-reduce:animate-none"
              >
                <span className="relative h-12 w-12 shrink-0 rounded-lg bg-sand">
                  {(option.image ?? linePresale?.cover ?? presale.cover) && (
                    <Img src={option.image ?? linePresale?.cover ?? presale.cover ?? ""} alt="" width={48} className="h-12 w-12 rounded-lg object-cover" />
                  )}
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1 text-[11px] font-bold tabular-nums text-charcoal">
                    {quantity}
                  </span>
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-navy">
                  {multi && linePresale ? <span className="block truncate text-xs font-normal text-navy/70">{linePresale.title}</span> : null}
                  {option.name}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-navy">{currency(Number(option.price) * quantity)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* How it gets to you */}
        <section className="mt-5">
          <h3 className={sectionTitle}>Entrega</h3>
          <div className="mt-2 flex items-start gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-navy/10">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand text-lg">
              {delivery === "shipping" ? "🚚" : "🏪"}
            </span>
            <div className="min-w-0 text-sm">
              {delivery === "shipping" ? (
                <>
                  <p className="font-semibold text-navy">Envío a domicilio · {address.fullName}</p>
                  <p className="text-navy/75">{place}</p>
                  {address.reference ? <p className="text-navy/60">Referencias: {address.reference}</p> : null}
                  <p className="mt-1 text-xs text-navy/60">
                    {shippingEstimate !== null ? `Envío estimado ${currency(shippingEstimate)} · ` : ""}
                    {isFull ? "se cobra hoy" : "se cobra al liquidar, cotizado de nuevo cuando llegue todo"}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-navy">Recoger en tienda</p>
                  <p className="text-navy/75">Te avisamos cuando llegue. Lo recoges con tu código QR.</p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Money */}
        <section className="mt-5 rounded-2xl bg-navy p-4 text-cream">
          <dl className="space-y-1.5 text-sm">
            {isFull && discount > 0 && (
              <div className="flex justify-between gap-4 text-cream/80">
                <dt>Descuento por pago completo</dt>
                <dd className="tabular-nums text-sun">−{currency(discount)}</dd>
              </div>
            )}
            {shippingNow > 0 && (
              <div className="flex justify-between gap-4 text-cream/80">
                <dt>Envío</dt>
                <dd className="tabular-nums">{currency(shippingNow)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-cream/80">Hoy pagas</dt>
              <dd className="text-2xl font-semibold tabular-nums">{currency(payNow + shippingNow)}</dd>
            </div>
            {!isFull && (
              <>
                <div className="flex justify-between gap-4 text-cream/80">
                  <dt>Te faltarán</dt>
                  <dd className="tabular-nums">
                    {currency(left)}
                    {delivery === "shipping" ? " + envío" : ""}
                  </dd>
                </div>
                <p className="text-xs text-cream/60">Liquida antes del {deadline}, o 15 días después de que llegue el disco.</p>
              </>
            )}
          </dl>
        </section>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-navy/10">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-orange"
          />
          <span className="text-sm leading-relaxed text-navy">
            {props.termsText}{" "}
            <Link to="/terminos-y-condiciones#preventas" target="_blank" className="font-semibold text-denim underline underline-offset-2">
              Ver condiciones
            </Link>
          </span>
        </label>

        {props.error && (
          <p role="alert" className="mt-3 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
            {props.error}
          </p>
        )}

        <button
          type="button"
          disabled={!accepted || props.sending}
          onClick={props.onConfirm}
          className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill bg-orange px-7 text-sm font-semibold text-charcoal transition duration-300 hover:-translate-y-0.5 hover:bg-amber active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-navy/10 disabled:text-navy/50 disabled:hover:translate-y-0 motion-reduce:transition-none"
        >
          {props.sending ? "Abriendo el pago…" : `Pagar ${currency(payNow + shippingNow)}`}
          {!props.sending && <span aria-hidden="true">→</span>}
        </button>
        <p className="mt-2 text-center text-xs text-navy/60">
          {accepted ? "Pagas con tarjeta en Stripe. Tus copias quedan guardadas 30 minutos." : "Acepta las condiciones para continuar."}
        </p>
      </div>
    </Modal>
  );
}
