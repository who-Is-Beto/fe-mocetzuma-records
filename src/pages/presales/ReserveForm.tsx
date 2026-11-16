import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Presale, PresaleDelivery, PresaleOption } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { extractErrorMessage, HttpError } from "../../app/lib/httpClient";
import { useAuth } from "../../app/providers/AuthProvider";
import { createCartService, type ShippingLocation } from "../../app/services/cartService";
import { createPresaleService } from "../../app/services/presaleService";
import { clearBag, type BagPresale } from "../../app/lib/presaleBag";
import { ARRIVAL_TEXT, DEPOSIT_TEXT, shortDate } from "../../components/presales/presaleText";
import { REQUIRED_ADDRESS_FIELDS } from "../cart/addressFields";
import { ShippingAddressFields, type ShippingAddressValues } from "../cart/ShippingAddressFields";
import { ReviewSheet } from "./ReviewSheet";

type AmountChoice = "min" | "half" | "full" | "custom";

const EMPTY_ADDRESS: ShippingAddressValues = {
  fullName: "",
  phone: "",
  street: "",
  number: "",
  neighborhood: "",
  city: "",
  state: "",
  zip: "",
  reference: ""
};


const money = (n: number) => Math.round(n * 100) / 100;
const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const chipClass = (active: boolean, disabled = false) =>
  `min-h-[48px] rounded-2xl border px-4 py-2 text-left text-sm transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
    disabled
      ? "cursor-not-allowed border-navy/10 text-navy/40"
      : active
        ? "border-orange bg-orange/10 text-navy shadow-[inset_0_0_0_1px_theme(colors.orange)]"
        : "border-navy/15 bg-white/70 text-navy hover:border-orange/60"
  }`;

const inputClass =
  "mt-1 min-h-[44px] w-full rounded-xl border border-navy/15 bg-white px-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-orange aria-[invalid=true]:border-coral";

type Props = {
  presale: Pick<Presale, "title" | "artist" | "cover">;
  /** The versions picked (this page's and any other presale in the bag) and how many of each. */
  lines: { option: PresaleOption; quantity: number; presale?: BagPresale }[];
};

/**
 * Reserve the versions picked on the page in one order: how much to pay today, pickup or shipping,
 * then a review sheet (the order, delivery, money and the 120-day rule) before Stripe. Totals are re-checked by the
 * server; the summary here is what the buyer agrees to.
 */
export function ReserveForm({ presale, lines }: Props) {
  const { token, isAuthenticated, emailVerified, user, resendVerification } = useAuth();
  const location = useLocation();
  const service = useMemo(() => createPresaleService({ getToken: () => token ?? null }), [token]);
  const cartService = useMemo(() => createCartService({ getToken: () => token ?? null }), [token]);
  const ids = useId();

  const [choice, setChoice] = useState<AmountChoice>("min");
  const [custom, setCustom] = useState("");
  const [delivery, setDelivery] = useState<PresaleDelivery>("pickup");
  const [address, setAddress] = useState<ShippingAddressValues>(EMPTY_ADDRESS);
  const [reviewing, setReviewing] = useState(false);
  const [colonias, setColonias] = useState<{ zip: string; list: ShippingLocation[] } | null>(null);
  const [quote, setQuote] = useState<{ zip: string; amount: number | null; error: string } | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [verifySent, setVerifySent] = useState(false);
  const firstInvalid = useRef<HTMLElement | null>(null);

  // Every amount is the sum over the lines (each version × its copies).
  const sum = (pick: (o: PresaleOption) => string) => money(lines.reduce((t, l) => t + Number(pick(l.option)) * l.quantity, 0));
  const price = sum((o) => o.price);
  const discount = sum((o) => o.full_payment_discount);
  const fullPrice = money(price - discount);
  const minimum = sum((o) => o.min_deposit);
  const half = money(Math.max(minimum, price / 2));

  const amount =
    choice === "min" ? minimum : choice === "half" ? half : choice === "full" ? fullPrice : Number(custom.replace(",", "."));
  const isFull = lines.length > 0 && amount >= fullPrice;
  const payNow = isFull ? fullPrice : amount;
  const left = isFull ? 0 : money(price - amount);
  const zip = address.zip.replace(/\D/g, "");
  const items = lines.map((l) => ({ option_id: l.option.id, quantity: l.quantity }));
  // A quote is for these exact copies to this ZIP.
  const quoteKey = `${items.map((i) => `${i.option_id}:${i.quantity}`).join(",")}@${zip}`;

  // Sepomex colonias for the ZIP, same as checkout: a dropdown that also fills city and state.
  useEffect(() => {
    if (delivery !== "shipping" || zip.length !== 5 || colonias?.zip === zip) return;
    let alive = true;
    cartService
      .fetchLocations(zip)
      .then(({ locations }) => {
        if (!alive) return;
        setColonias({ zip, list: locations });
        setAddress((a) => ({
          ...a,
          neighborhood: "",
          ...(locations.length > 0 ? { city: locations[0].city, state: locations[0].state } : {})
        }));
      })
      .catch(() => alive && setColonias({ zip, list: [] })); // lookup down: type it instead
    return () => {
      alive = false;
    };
  }, [delivery, zip, colonias?.zip, cartService]);
  const coloniaOptions = colonias?.zip === zip ? colonias.list : [];

  // Shipping estimate as soon as there's a 5-digit ZIP.
  useEffect(() => {
    if (delivery !== "shipping" || lines.length === 0 || zip.length !== 5) return;
    if (quote?.zip === quoteKey) return;
    let alive = true;
    service
      .estimateShipping(items, zip)
      .then((res) => alive && setQuote({ zip: quoteKey, amount: Number(res.shipping_estimate), error: "" }))
      .catch(
        (err) =>
          alive &&
          setQuote({
            zip: quoteKey,
            amount: null,
            error: extractErrorMessage(err, "No pudimos cotizar el envío a ese código postal.")
          })
      );
    return () => {
      alive = false;
    };
    // items is derived from quoteKey: the key is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery, quoteKey, quote?.zip, service]);

  const shippingEstimate = delivery === "shipping" && quote?.zip === quoteKey ? quote.amount : null;
  const shippingNow = isFull && delivery === "shipping" ? shippingEstimate ?? 0 : 0;

  const problems: Record<string, string> = {};
  const short = lines.find((l) => l.quantity > l.option.copies_left);
  if (lines.length === 0) problems.option = "Elige al menos un disco.";
  else if (short) problems.option = `Solo quedan ${short.option.copies_left} de ${short.option.name}.`;
  if (!Number.isFinite(amount) || amount <= 0) problems.amount = "Escribe cuánto quieres pagar hoy.";
  else if (!/^\d+([.,]\d{1,2})?$/.test(String(choice === "custom" ? custom : amount))) problems.amount = "Usa hasta 2 decimales.";
  else if (amount < minimum) problems.amount = `El apartado mínimo es ${currency(minimum)}.`;
  else if (amount > price) problems.amount = `El precio es ${currency(price)}.`;
  if (delivery === "shipping") {
    for (const field of REQUIRED_ADDRESS_FIELDS) {
      if (!address[field.id].trim()) problems[field.id] = `Falta ${field.label.toLowerCase()}.`;
    }
    if (address.zip && zip.length !== 5) problems.zip = "El código postal tiene 5 dígitos.";
    else if (isFull && zip.length === 5 && shippingEstimate === null) problems.zip = quote?.error || "Cotizando envío…";
  }
  const missing = Object.keys(problems);
  const canSend = missing.length === 0 && !sending;
  const shown = (key: string) => (touched[key] ? problems[key] : undefined);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) {
      setTouched(Object.fromEntries(missing.map((k) => [k, true])));
      firstInvalid.current = document.querySelector<HTMLElement>(`[data-field="${missing[0]}"]`);
      firstInvalid.current?.focus();
      return;
    }
    setError("");
    setReviewing(true);
  };

  const confirm = async () => {
    setSending(true);
    setError("");
    try {
      const { checkout_url } = await service.reserve({
        items,
        amount: payNow.toFixed(2),
        delivery,
        ...(delivery === "shipping" ? { shipping_details: { ...address, zip } } : {}),
        accept_terms: true
      });
      clearBag(); // the order now holds every line
      window.location.assign(checkout_url);
    } catch (err) {
      setSending(false);
      setError(
        // 409: sold out or over the per-person limit; the server names the version.
        extractErrorMessage(err, err instanceof HttpError && err.status === 409
          ? "Alguien apartó la última copia de esa versión hace un momento."
          : "No pudimos iniciar el pago. Intenta de nuevo.")
      );
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-[22px] border border-navy/10 bg-white/80 p-6">
        <p className="font-semibold text-denim">Para apartar necesitas una cuenta</p>
        <p className="mt-1 text-sm text-navy/70">Así guardamos tus pagos y tu código de entrega en un solo lugar.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/login"
            state={{ from: location }}
            className="inline-flex min-h-[48px] items-center rounded-pill bg-orange px-6 text-sm font-semibold text-charcoal transition hover:-translate-y-0.5 hover:bg-amber"
          >
            Iniciar sesión para apartar
          </Link>
          <Link
            to="/register"
            state={{ from: location }}
            className="inline-flex min-h-[48px] items-center rounded-pill border border-navy/15 px-6 text-sm font-semibold text-navy transition hover:border-orange hover:text-orange"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    );
  }

  if (emailVerified === false) {
    return (
      <div className="rounded-[22px] border border-orange/40 bg-sun/20 p-6">
        <p className="font-semibold text-denim">Verifica tu correo para apartar</p>
        <p className="mt-1 text-sm text-navy/75">Te enviamos un enlace a {user?.email}. Ábrelo y vuelve a esta página.</p>
        <button
          type="button"
          disabled={verifySent}
          onClick={async () => {
            if (!user?.email) return;
            await resendVerification(user.email).catch(() => undefined);
            setVerifySent(true);
          }}
          className="mt-4 min-h-[44px] rounded-pill border border-navy/15 bg-white px-5 text-sm font-semibold text-navy disabled:opacity-60"
        >
          {verifySent ? "Enlace reenviado" : "Reenviar enlace"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-7">

      {/* 2. Amount */}
      {lines.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold text-navy">¿Cuánto pagas hoy?</legend>
          <div className="mt-2 grid gap-2 min-[420px]:grid-cols-2" role="radiogroup" data-field="amount" tabIndex={-1}>
            <button type="button" role="radio" aria-checked={choice === "min"} onClick={() => setChoice("min")} className={chipClass(choice === "min")}>
              <span className="block font-semibold">Apartado mínimo</span>
              <span className="block text-xs tabular-nums text-navy/70">{currency(minimum)}</span>
            </button>
            {half > minimum && half < fullPrice && (
              <button type="button" role="radio" aria-checked={choice === "half"} onClick={() => setChoice("half")} className={chipClass(choice === "half")}>
                <span className="block font-semibold">La mitad</span>
                <span className="block text-xs tabular-nums text-navy/70">{currency(half)}</span>
              </button>
            )}
            <button type="button" role="radio" aria-checked={choice === "full"} onClick={() => setChoice("full")} className={chipClass(choice === "full")}>
              <span className="block font-semibold">Pago completo</span>
              <span className="block text-xs tabular-nums text-navy/70">
                {currency(fullPrice)}
                {discount > 0 && <span className="ml-1 font-semibold text-orange">ahorras {currency(discount)}</span>}
              </span>
            </button>
            <button type="button" role="radio" aria-checked={choice === "custom"} onClick={() => setChoice("custom")} className={chipClass(choice === "custom")}>
              <span className="block font-semibold">Otra cantidad</span>
              <span className="block text-xs text-navy/70">Desde {currency(minimum)}</span>
            </button>
          </div>
          {choice === "custom" && (
            <label className="mt-3 block max-w-xs">
              <span className="text-xs font-semibold text-navy/80">Cantidad en pesos</span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-navy/60">$</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/[^\d.,]/g, ""))}
                  onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                  aria-invalid={Boolean(shown("amount")) || undefined}
                  className={`${inputClass} pl-7 tabular-nums`}
                />
              </span>
            </label>
          )}
          {shown("amount") && <p className="mt-1.5 text-sm text-coral">{problems.amount}</p>}
        </fieldset>
      )}

      {/* 3. Delivery */}
      <fieldset>
        <legend className="text-sm font-semibold text-navy">¿Cómo lo recibes?</legend>
        <div className="mt-2 grid gap-2 min-[420px]:grid-cols-2" role="radiogroup">
          <button type="button" role="radio" aria-checked={delivery === "pickup"} onClick={() => setDelivery("pickup")} className={chipClass(delivery === "pickup")}>
            <span className="block font-semibold">Recoger en tienda</span>
            <span className="block text-xs text-navy/70">Sin costo, con tu código</span>
          </button>
          <button type="button" role="radio" aria-checked={delivery === "shipping"} onClick={() => setDelivery("shipping")} className={chipClass(delivery === "shipping")}>
            <span className="block font-semibold">Envío a domicilio</span>
            <span className="block text-xs text-navy/70">A todo México</span>
          </button>
        </div>

        {delivery === "shipping" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ShippingAddressFields
                idPrefix={ids}
                values={address}
                errors={Object.fromEntries(REQUIRED_ADDRESS_FIELDS.map((f) => [f.id, shown(f.id)]))}
                locations={coloniaOptions}
                locationsZip={zip}
                onChange={(field, value) => setAddress((a) => ({ ...a, [field]: value }))}
                onBlur={(field) => setTouched((t) => ({ ...t, [field]: true }))}
              />
            </div>
            <p className="text-sm text-navy/75 sm:col-span-2" aria-live="polite">
              {zip.length === 5 && shippingEstimate !== null
                ? `Envío estimado: ${currency(shippingEstimate)} · ${isFull ? "se cobra hoy" : "se paga al liquidar, cotizado de nuevo cuando llegue el disco"}`
                : zip.length === 5 && quote?.error
                  ? quote.error
                  : zip.length === 5
                    ? "Cotizando envío…"
                    : "Escribe tu código postal para estimar el envío."}
            </p>
          </div>
        )}
      </fieldset>

      {/* 4. Summary + terms */}
      {lines.length > 0 && (
        <div className="rounded-[22px] bg-navy p-5 text-cream sm:p-6">
          <ul className="mb-4 space-y-1 border-b border-cream/15 pb-4 text-sm">
            {lines.map((l) => (
              <li key={l.option.id} className="flex items-baseline justify-between gap-4">
                <span className="min-w-0 text-cream/85">
                  {l.option.name} <span className="tabular-nums text-cream/60">×{l.quantity}</span>
                </span>
                <span className="shrink-0 tabular-nums">{currency(Number(l.option.price) * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-cream/75">Hoy pagas</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {Number.isFinite(payNow) && payNow > 0 ? currency(payNow + shippingNow) : "—"}
              </dd>
            </div>
            {isFull ? (
              <p className="text-cream/80">
                Pago completo{discount > 0 ? ` con ${currency(discount)} de descuento` : ""}
                {delivery === "shipping" ? ", envío incluido" : ""}. No te faltará nada.
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-cream/75">Te faltarán</dt>
                  <dd className="font-semibold tabular-nums">
                    {Number.isFinite(left) && left > 0 ? currency(left) : "—"}
                    {delivery === "shipping" ? " + envío" : ""}
                  </dd>
                </div>
                <p className="text-cream/80">
                  Tienes 120 días para liquidar: hasta el {shortDate(addDays(120))}.
                </p>
              </>
            )}
          </dl>

          <button
            type="submit"
            aria-disabled={!canSend}
            aria-describedby={!canSend && missing.length ? `${ids}-missing` : undefined}
            className={`mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill px-7 text-sm font-semibold transition duration-300 ${
              canSend
                ? "bg-orange text-charcoal hover:-translate-y-0.5 hover:bg-amber active:translate-y-0"
                : "cursor-not-allowed bg-cream/20 text-cream/70"
            }`}
          >
            Revisar y pagar <span aria-hidden="true">→</span>
          </button>
          {!canSend && !sending && missing.length > 0 && (
            <p id={`${ids}-missing`} className="mt-2 text-center text-xs text-cream/75">
              Para continuar: {Object.values(problems)[0].charAt(0).toLowerCase()}
              {Object.values(problems)[0].slice(1, -1)}
              {missing.length > 1 ? ` (y ${missing.length - 1} más)` : ""}.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-coral/20 px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <p className="mt-3 text-center text-xs text-cream/60">Antes de pagar ves todo tu pedido.</p>
        </div>
      )}
      <ReviewSheet
        open={reviewing}
        presale={presale}
        lines={lines}
        delivery={delivery}
        address={{ ...address, zip }}
        shippingEstimate={shippingEstimate}
        payNow={payNow}
        shippingNow={shippingNow}
        left={left}
        isFull={isFull}
        discount={discount}
        deadline={shortDate(addDays(120))}
        termsText={isFull ? ARRIVAL_TEXT : DEPOSIT_TEXT}
        sending={sending}
        error={error}
        onConfirm={() => void confirm()}
        onClose={() => setReviewing(false)}
      />
    </form>
  );
}
