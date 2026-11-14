import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import type { PresaleDelivery, PresaleOption, ShippingAddress } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { extractErrorMessage, HttpError } from "../../app/lib/httpClient";
import { useAuth } from "../../app/providers/AuthProvider";
import { createCartService, type ShippingLocation } from "../../app/services/cartService";
import { createPresaleService } from "../../app/services/presaleService";
import { shortDate } from "../../components/presales/presaleText";

type AmountChoice = "min" | "half" | "full" | "custom";

const ADDRESS_FIELDS: { id: keyof ShippingAddress; label: string; type?: string; auto: string; wide?: boolean }[] = [
  { id: "fullName", label: "Nombre de quien recibe", auto: "name", wide: true },
  { id: "phone", label: "Teléfono", type: "tel", auto: "tel" },
  { id: "zip", label: "Código postal", auto: "postal-code" },
  { id: "street", label: "Calle", auto: "address-line1", wide: true },
  { id: "number", label: "Número", auto: "address-line2" },
  { id: "neighborhood", label: "Colonia", auto: "address-level3" },
  { id: "city", label: "Ciudad o alcaldía", auto: "address-level2" },
  { id: "state", label: "Estado", auto: "address-level1" }
];

const EMPTY_ADDRESS: ShippingAddress = {
  fullName: "",
  phone: "",
  street: "",
  number: "",
  neighborhood: "",
  city: "",
  state: "",
  zip: ""
};

const TERMS_TEXT =
  "Acepto que si no liquido mi preventa en 120 días (o 15 días después de que el disco llegue a tienda, lo que pase después) pierdo mi apartado.";

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
  option: PresaleOption | null;
};

/**
 * Reserve the version picked on the page: how much to pay today, pickup or shipping,
 * accept the 120-day rule, then pay in Stripe. Totals are re-checked by the
 * server; the summary here is what the buyer agrees to.
 */
export function ReserveForm({ option }: Props) {
  const { token, isAuthenticated, emailVerified, user, resendVerification } = useAuth();
  const location = useLocation();
  const service = useMemo(() => createPresaleService({ getToken: () => token ?? null }), [token]);
  const cartService = useMemo(() => createCartService({ getToken: () => token ?? null }), [token]);
  const ids = useId();

  const [choice, setChoice] = useState<AmountChoice>("min");
  const [custom, setCustom] = useState("");
  const [delivery, setDelivery] = useState<PresaleDelivery>("pickup");
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [accepted, setAccepted] = useState(false);
  const [colonias, setColonias] = useState<{ zip: string; list: ShippingLocation[] } | null>(null);
  const [quote, setQuote] = useState<{ zip: string; amount: number | null; error: string } | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [verifySent, setVerifySent] = useState(false);
  const firstInvalid = useRef<HTMLElement | null>(null);

  const price = option ? Number(option.price) : 0;
  const discount = option ? Number(option.full_payment_discount) : 0;
  const fullPrice = money(price - discount);
  const minimum = option ? Number(option.min_deposit) : 0;
  const half = money(Math.max(minimum, price / 2));

  const amount =
    choice === "min" ? minimum : choice === "half" ? half : choice === "full" ? fullPrice : Number(custom.replace(",", "."));
  const isFull = option !== null && amount >= fullPrice;
  const payNow = isFull ? fullPrice : amount;
  const left = isFull ? 0 : money(price - amount);
  const zip = address.zip.replace(/\D/g, "");

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
    if (delivery !== "shipping" || !option || zip.length !== 5) return;
    if (quote?.zip === `${option.id}:${zip}`) return;
    let alive = true;
    service
      .estimateShipping(option.id, zip)
      .then((res) => alive && setQuote({ zip: `${option.id}:${zip}`, amount: Number(res.shipping_estimate), error: "" }))
      .catch(
        (err) =>
          alive &&
          setQuote({
            zip: `${option.id}:${zip}`,
            amount: null,
            error: extractErrorMessage(err, "No pudimos cotizar el envío a ese código postal.")
          })
      );
    return () => {
      alive = false;
    };
  }, [delivery, option, zip, quote?.zip, service]);

  const shippingEstimate = delivery === "shipping" && quote?.zip === `${option?.id}:${zip}` ? quote.amount : null;
  const shippingNow = isFull && delivery === "shipping" ? shippingEstimate ?? 0 : 0;

  const problems: Record<string, string> = {};
  if (!option) problems.option = "Elige una versión.";
  else if (option.copies_left <= 0) problems.option = "Esa versión ya se agotó.";
  if (!Number.isFinite(amount) || amount <= 0) problems.amount = "Escribe cuánto quieres pagar hoy.";
  else if (!/^\d+([.,]\d{1,2})?$/.test(String(choice === "custom" ? custom : amount))) problems.amount = "Usa hasta 2 decimales.";
  else if (amount < minimum) problems.amount = `El apartado mínimo es ${currency(minimum)}.`;
  else if (amount > price) problems.amount = `El precio es ${currency(price)}.`;
  if (delivery === "shipping") {
    for (const field of ADDRESS_FIELDS) {
      if (!address[field.id].trim()) problems[field.id] = `Falta ${field.label.toLowerCase()}.`;
    }
    if (address.zip && zip.length !== 5) problems.zip = "El código postal tiene 5 dígitos.";
    else if (isFull && zip.length === 5 && shippingEstimate === null) problems.zip = quote?.error || "Cotizando envío…";
  }
  if (!accepted) problems.terms = "Acepta las condiciones de la preventa.";
  const missing = Object.keys(problems);
  const canSend = missing.length === 0 && !sending;
  const shown = (key: string) => (touched[key] ? problems[key] : undefined);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend || !option) {
      setTouched(Object.fromEntries(missing.map((k) => [k, true])));
      firstInvalid.current = document.querySelector<HTMLElement>(`[data-field="${missing[0]}"]`);
      firstInvalid.current?.focus();
      return;
    }
    setSending(true);
    setError("");
    try {
      const { checkout_url } = await service.reserve({
        option_id: option.id,
        amount: payNow.toFixed(2),
        delivery,
        ...(delivery === "shipping" ? { shipping_details: { ...address, zip } } : {}),
        accept_terms: true
      });
      window.location.assign(checkout_url);
    } catch (err) {
      setSending(false);
      setError(
        err instanceof HttpError && err.status === 409
          ? "Alguien apartó la última copia de esa versión hace un momento."
          : extractErrorMessage(err, "No pudimos iniciar el pago. Intenta de nuevo.")
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
      {option && (
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
            {ADDRESS_FIELDS.map((field) => (
              <label key={field.id} className={`block ${field.wide ? "sm:col-span-2" : ""}`}>
                <span className="text-xs font-semibold text-navy/80">{field.label}</span>
                {field.id === "neighborhood" && coloniaOptions.length > 0 ? (
                  <select
                    data-field={field.id}
                    autoComplete={field.auto}
                    value={address.neighborhood}
                    onChange={(e) => setAddress((a) => ({ ...a, neighborhood: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, neighborhood: true }))}
                    aria-invalid={Boolean(shown(field.id)) || undefined}
                    aria-describedby={shown(field.id) ? `${ids}-${field.id}` : undefined}
                    className={inputClass}
                  >
                    <option value="">Selecciona tu colonia ({coloniaOptions.length})</option>
                    {coloniaOptions.map((loc) => (
                      <option key={loc.neighborhood} value={loc.neighborhood}>
                        {loc.neighborhood}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    data-field={field.id}
                    type={field.type ?? "text"}
                    autoComplete={field.auto}
                    inputMode={field.id === "zip" ? "numeric" : undefined}
                    maxLength={field.id === "zip" ? 5 : 200}
                    value={address[field.id]}
                    onChange={(e) => setAddress((a) => ({ ...a, [field.id]: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, [field.id]: true }))}
                    aria-invalid={Boolean(shown(field.id)) || undefined}
                    aria-describedby={shown(field.id) ? `${ids}-${field.id}` : undefined}
                    className={inputClass}
                  />
                )}
                {shown(field.id) && (
                  <span id={`${ids}-${field.id}`} className="mt-1 block text-xs text-coral">
                    {problems[field.id]}
                  </span>
                )}
              </label>
            ))}
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
      {option && (
        <div className="rounded-[22px] bg-navy p-5 text-cream sm:p-6">
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
                  Tienes hasta el {shortDate(addDays(120))} para liquidar, y nunca menos de 15 días después de que llegue
                  el disco.
                </p>
              </>
            )}
          </dl>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-cream/10 p-3">
            <input
              data-field="terms"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-orange"
            />
            <span className="text-sm leading-relaxed">
              {TERMS_TEXT}{" "}
              <Link to="/terminos-y-condiciones#preventas" target="_blank" className="font-semibold text-sun underline underline-offset-2">
                Ver condiciones
              </Link>
            </span>
          </label>

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
            {sending ? "Abriendo el pago…" : isFull ? "Pagar mi preventa" : "Apartar mi copia"}
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
          <p className="mt-3 text-center text-xs text-cream/60">Pagas con tarjeta en Stripe. Tu copia queda guardada 30 minutos mientras pagas.</p>
        </div>
      )}
    </form>
  );
}
