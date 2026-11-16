import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { ListSkeleton, Skeleton } from "../../components/Skeleton";
import { Spinner } from "../../components/Loader";
import { StatusPanel } from "../../components/StatusPanel";
import { primaryCta, secondaryCta } from "../../components/cta";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../app/providers/AuthProvider";
import { useServiceQuery } from "../../app/hooks";
import { useSeo } from "../../app/hooks/useSeo";
import { useUpcomingBazares } from "../../app/hooks/useUpcomingBazares";
import { useShippingQuote } from "../../app/hooks/useShippingQuote";
import { createCartService, type CartResponse } from "../../app/services/cartService";
import type { ShippingDetails, ShippingLocation } from "../../app/domain/shipping";
import { getCartCode, persistCartCode } from "../../app/lib/cartStorage";
import { isVerificationError, extractErrorMessage } from "../../app/lib/httpClient";
import type { DeliveryOptionKey } from "./DeliveryOptions";
import { DeliveryOptions } from "./DeliveryOptions";
import { BazarPicker } from "./BazarPicker";
import { CartItemRow } from "./CartItemRow";
import {
  ShippingAddressFields,
  type ShippingAddressValues
} from "./ShippingAddressFields";
import { currency } from "../../app/lib/format";
import { presaleTotals, usePresaleBag } from "../../app/lib/presaleBag";
import { createPresaleService } from "../../app/services/presaleService";
import { ARRIVAL_TEXT, DEPOSIT_TEXT } from "../../components/presales/presaleText";
import { CartPresales, type PresalePay } from "./CartPresales";

const SHIPPING_REQUIRED_FIELDS: Array<keyof ShippingDetails> = [
  "fullName",
  "phone",
  "street",
  "number",
  "neighborhood",
  "city",
  "state",
  "zip"
];

/**
 * /carrito — cart contents plus the checkout summary. This component owns
 * state and orchestration (cart fetch, shipping quote, Sepomex colonias,
 * checkout call); presentation is delegated to CartItemRow, DeliveryOptions,
 * BazarPicker and ShippingAddressFields.
 */
export function CartPage() {
  useSeo({ title: "Tu carrito", noindex: true });
  const { token, isAuthenticated, emailVerified, user, resendVerification } =
    useAuth();
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent"
  >("idle");
  const [blockedByApi, setBlockedByApi] = useState(false);
  const [deliveryOption, setDeliveryOption] =
    useState<DeliveryOptionKey | null>(null);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddressValues>({
    fullName: "",
    phone: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    zip: "",
    reference: ""
  });
  const [shippingErrors, setShippingErrors] = useState<
    Record<string, string>
  >({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  // Sepomex colonias for the entered ZIP (one ZIP can cover several). Empty
  // list → fall back to the free-text colonia input.
  const [locations, setLocations] = useState<ShippingLocation[]>([]);
  const [locationsZip, setLocationsZip] = useState<string | null>(null);
  const shippingFormRef = useRef<HTMLFormElement | null>(null);

  /* ── Presales picked on their pages, paid in this same checkout ── */
  const bag = usePresaleBag();
  const hasPresale = bag.length > 0;
  const [presalePay, setPresalePay] = useState<PresalePay>("min");
  // Home delivery with a presale: one box when it arrives (true) or records now + presale later (false).
  const [shipTogether, setShipTogether] = useState<boolean | null>(null);
  const [presaleTerms, setPresaleTerms] = useState(false);
  const [presaleQuote, setPresaleQuote] = useState<{ key: string; amount: number | null; error: string } | null>(null);
  const presaleService = useMemo(() => createPresaleService({ getToken: () => token ?? null }), [token]);

  /* ── Bazar pickup: upcoming bazares to choose from ──
     Fetched through the shared hook once the picker option is selected
     (re-opening the option refreshes the list; errors offer a retry). */
  const [selectedBazarId, setSelectedBazarId] = useState<number | null>(null);
  const [bazaresRequested, setBazaresRequested] = useState(false);
  const {
    bazares,
    isLoading: bazaresLoading,
    error: bazaresError,
    retry: retryFetchBazares
  } = useUpcomingBazares({ enabled: bazaresRequested });

  useEffect(() => {
    if (deliveryOption === "bazar") {
      setBazaresRequested(true);
    } else {
      setSelectedBazarId(null);
    }
  }, [deliveryOption]);

  useEffect(() => {
    if (deliveryOption !== "home") {
      setShippingErrors({});
    }
  }, [deliveryOption]);

  /* ── Checkout gating for bazar pickup ──
     No bazares loaded & none available → can't fulfill pickup at all.
     Bazares exist but none picked → must choose first.
     While the list hasn't been requested/is loading we don't know yet, so
     the button stays clickable and handleCheckout's toast covers it. */
  const noBazaresAvailable =
    deliveryOption === "bazar" &&
    bazaresRequested &&
    !bazaresLoading &&
    !bazaresError &&
    bazares.length === 0;
  const bazarNotSelected = deliveryOption === "bazar" && selectedBazarId == null;

  const showToast = (message: string, tone: "error" | "success") => {
    setToast({ message, tone });
  };

  const cartService = useMemo(
    () => createCartService({ getToken: () => token }),
    [token]
  );

  // `null` (legacy session before email_verified existed) counts as unverified;
  // the API also enforces the gate as a fallback (blockedByApi).
  const requiresVerification = isAuthenticated && emailVerified !== true;
  const canUseCart =
    isAuthenticated && !requiresVerification && !blockedByApi && Boolean(token);

  const fetchCart = useCallback(async (): Promise<CartResponse | null> => {
    if (!canUseCart) return null;
    try {
      const cached = getCartCode();
      const code =
        cached ??
        (await cartService.getCarts().then((carts) => carts[0]?.cart_code)) ??
        null;
      if (!code) return null;
      if (!cached) persistCartCode(code);
      return await cartService.getCart(code);
    } catch (err) {
      if (isVerificationError(err)) {
        setBlockedByApi(true);
        return null;
      }
      throw err;
    }
  }, [canUseCart, cartService]);

  const { data, isLoading, isError, refetch } = useServiceQuery<
    CartResponse | null
  >([cartService, canUseCart], fetchCart, { enabled: canUseCart });

  const cart = data ?? null;
  const cartCode = cart?.cart_code ?? getCartCode();
  const items = cart?.cart_items ?? [];
  // Only presales, no store records: paid as a presale reservation (pickup at the store or shipping).
  const presaleOnly = hasPresale && items.length === 0;
  // One box with the records only makes sense when there are records.
  const together = presaleOnly ? false : shipTogether;
  // Records removed while "Recoger en bazar" was picked: presales alone aren't picked up at a bazar.
  useEffect(() => {
    if (presaleOnly && deliveryOption === "bazar") setDeliveryOption(null);
  }, [presaleOnly, deliveryOption]);
  const presaleHome = hasPresale && deliveryOption === "home";
  const presaleBlocked = hasPresale && (!presaleTerms || (presaleHome && together === null));
  const checkoutDisabled =
    !deliveryOption || isCheckingOut || noBazaresAvailable || bazarNotSelected || presaleBlocked;

  // Content signature of the cart (which records × how many). Quantity edits
  // change the package weight, so the shipping quote must be recalculated —
  // items.length alone misses same-line quantity changes.
  const cartSignature = useMemo(
    () =>
      items
        .map((item) => `${item.record?.id ?? item.id}x${item.quantity}`)
        .sort()
        .join("|"),
    [items]
  );

  const refreshCart = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Live shipping quote: once a home-delivery ZIP is complete, ask the
  // backend (Envíos Perros) for the cost so the total stays up to date.
  // Debounced and keyed on the cart content signature (quantity changes
  // alter package weight). The final charge is always re-quoted server-side
  // at checkout.
  const {
    quote: shippingQuote,
    isQuoting,
    error: quoteError
  } = useShippingQuote({
    token,
    cartCode,
    zip: shippingAddress.zip,
    // Everything in the presale's box: the records have no shipping of their own.
    enabled: deliveryOption === "home" && items.length > 0 && !(hasPresale && shipTogether === true),
    version: cartSignature
  });

  // Sepomex colonias for the ZIP: powers the colonia dropdown and pre-fills
  // city/state. Label generation later requires the exact Sepomex name, so we
  // never let users free-type when valid options exist.
  useEffect(() => {
    const zip = shippingAddress.zip.trim();
    if (!/^\d{5}$/.test(zip)) {
      setLocations([]);
      setLocationsZip(null);
      return;
    }
    if (zip === locationsZip) return;
    let cancelled = false;
    cartService
      .fetchLocations(zip)
      .then(({ locations: found }) => {
        if (cancelled) return;
        setLocations(found);
        setLocationsZip(zip);
        // The previously chosen colonia belonged to another ZIP.
        setShippingAddress((prev) => ({
          ...prev,
          neighborhood: "",
          ...(found.length > 0
            ? { city: found[0].city, state: found[0].state }
            : {})
        }));
      })
      .catch(() => {
        // Upstream hiccup: keep whatever mode the form was in.
        if (!cancelled) setLocationsZip(null);
      });
    return () => {
      cancelled = true;
    };
  }, [shippingAddress.zip, locationsZip, cartService]);

  // Presale shipping estimate (with the cart records when it all goes in one box).
  const presaleZip = shippingAddress.zip.replace(/\D/g, "");
  const presaleItems = bag.map((l) => ({ option_id: l.option.id, quantity: l.quantity }));
  const presaleQuoteKey = `${presaleItems.map((i) => `${i.option_id}:${i.quantity}`).join(",")}@${presaleZip}@${together}@${cartSignature}`;
  useEffect(() => {
    if (!presaleHome || together === null || presaleZip.length !== 5 || presaleQuote?.key === presaleQuoteKey) return;
    let alive = true;
    presaleService
      .estimateShipping(presaleItems, presaleZip, together ? cartCode ?? undefined : undefined)
      .then((res) => alive && setPresaleQuote({ key: presaleQuoteKey, amount: Number(res.shipping_estimate), error: "" }))
      .catch(
        (err) =>
          alive &&
          setPresaleQuote({ key: presaleQuoteKey, amount: null, error: extractErrorMessage(err, "No pudimos cotizar el envío.") })
      );
    return () => {
      alive = false;
    };
    // presaleItems / presaleZip are in the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presaleHome, presaleQuoteKey, presaleQuote?.key, presaleService, cartCode, together]);
  const presaleShipping = presaleQuote?.key === presaleQuoteKey ? presaleQuote : null;

  const handleUpdateQuantity = async (
    itemId: number | string,
    next: number
  ) => {
    if (next < 1) return;
    setActionLoadingId(itemId);
    try {
      const resp = await cartService.updateItem(itemId, next);
      // updateItem returns the updated cart — use it directly
      if (resp && 'cart_items' in resp) {
        // Update react-query cache directly so the UI reflects changes immediately
        refetch();
      } else {
        refreshCart();
      }
    } catch (err) {
      showToast(extractErrorMessage(err, "No se pudo actualizar el carrito."), "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveItem = async (recordId: string) => {
    if (!cartCode) return;
    setActionLoadingId(recordId);
    try {
      await cartService.removeItem(cartCode, recordId);
      // The backend now returns the updated cart — refetch to pick it up
      refetch();
    } catch (err) {
      if (isVerificationError(err)) {
        setBlockedByApi(true);
        return;
      }
      showToast("No se pudo quitar el artículo.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveAll = async () => {
    if (!cartCode) return;
    setIsClearing(true);
    try {
      await cartService.removeAll(cartCode);
      refetch();
    } catch (err) {
      if (isVerificationError(err)) {
        setBlockedByApi(true);
        return;
      }
      showToast("No se pudo vaciar el carrito.", "error");
    } finally {
      setIsClearing(false);
    }
  };

  const handleShippingChange = useCallback(
    (field: keyof ShippingAddressValues, value: string) => {
      setShippingAddress((prev) => ({ ...prev, [field]: value }));
      if (shippingErrors[field]) {
        setShippingErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [shippingErrors]
  );

  const readShippingDetailsFromForm = useCallback((): ShippingDetails | null => {
    if (!shippingFormRef.current) return null;
    const formData = new FormData(shippingFormRef.current);
    return {
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      street: String(formData.get("street") ?? ""),
      number: String(formData.get("number") ?? ""),
      neighborhood: String(formData.get("neighborhood") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
      zip: String(formData.get("zip") ?? ""),
      reference: String(formData.get("reference") ?? "")
    };
  }, []);

  const handleCheckout = async () => {
    if (!presaleOnly && (!cartCode || items.length === 0)) return;
    if (!deliveryOption) {
      showToast("Selecciona un método de entrega para continuar.", "error");
      return;
    }

    let shippingDetails: ShippingDetails | undefined;
    if (deliveryOption === "home") {
      shippingDetails = readShippingDetailsFromForm() ?? undefined;
      if (!shippingDetails) {
        showToast("Completa tu dirección para enviar.", "error");
        return;
      }
      const nextErrors: Record<string, string> = {};
      SHIPPING_REQUIRED_FIELDS.forEach((field) => {
        if (!shippingDetails?.[field]?.trim()) {
          nextErrors[field] = "Campo requerido";
        }
      });
      if (Object.keys(nextErrors).length) {
        setShippingErrors(nextErrors);
        showToast("Completa tu dirección para enviar.", "error");
        return;
      }
      setShippingErrors({});
    }

    if (deliveryOption === "bazar" && selectedBazarId == null) {
      showToast("Selecciona el bazar donde quieres recoger tu pedido.", "error");
      return;
    }

    if (hasPresale && (!presaleTerms || (deliveryOption === "home" && together === null))) {
      showToast("Revisa las condiciones de tu preventa antes de pagar.", "error");
      return;
    }
    const totals = presaleTotals(bag);
    const presaleItemsInput = bag.map((l) => ({ option_id: l.option.id, quantity: l.quantity }));
    const presaleAmount = (presalePay === "full" ? totals.full : totals.minimum).toFixed(2);

    if (presaleOnly) {
      // No store records: the same reservation as the presale page (one order, one payment).
      if (deliveryOption === "bazar") {
        showToast("Las preventas se recogen en la tienda o se envían a domicilio.", "error");
        return;
      }
      setIsCheckingOut(true);
      try {
        const { checkout_url } = await presaleService.reserve({
          items: presaleItemsInput,
          amount: presaleAmount,
          delivery: deliveryOption === "home" ? "shipping" : "pickup",
          ...(deliveryOption === "home" && shippingDetails
            ? { shipping_details: { ...shippingDetails, zip: shippingDetails.zip.replace(/\D/g, "") } }
            : {}),
          accept_terms: true
        });
        window.location.assign(checkout_url);
      } catch (err) {
        if (isVerificationError(err)) {
          setBlockedByApi(true);
          return;
        }
        setIsCheckingOut(false);
        showToast(extractErrorMessage(err, "No se pudo iniciar el pago."), "error");
      }
      return;
    }
    if (!cartCode) return;

    setIsCheckingOut(true);
    try {
      const { checkout_url } = await cartService.createCheckoutSession(
        cartCode,
        deliveryOption,
        shippingDetails ?? undefined,
        deliveryOption === "bazar" ? selectedBazarId ?? undefined : undefined,
        hasPresale
          ? {
              items: presaleItemsInput,
              amount: presaleAmount,
              accept_terms: true,
              ...(deliveryOption === "home" ? { ship_together: shipTogether === true } : {})
            }
          : undefined
      );
      if (checkout_url) {
        window.location.href = checkout_url;
      } else {
        showToast("No pudimos iniciar el pago. Intenta de nuevo.", "error");
      }
    } catch (err) {
      if (isVerificationError(err)) {
        setBlockedByApi(true);
        return;
      }
      showToast(extractErrorMessage(err, "No se pudo iniciar el pago."), "error");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleResend = async () => {
    if (!user?.email) return;
    setResendStatus("sending");
    try {
      await resendVerification(user.email);
      setResendStatus("sent");
    } catch {
      showToast("No pudimos reenviar el correo. Intenta de nuevo.", "error");
      setResendStatus("idle");
    }
  };

  // ── Gate: not authenticated ─────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <StatusPanel
        icon="🛒"
        eyebrow="Carrito"
        title="Inicia sesión para ver tu carrito"
        text="Tu carrito se guarda en tu cuenta: entra y sigue donde te quedaste."
        actions={
          <>
            <Link to="/login" className={primaryCta}>Iniciar sesión</Link>
            <Link to="/catalogo" className={secondaryCta}>Ver catálogo</Link>
          </>
        }
      />
    );
  }

  // ── Gate: authenticated but email not verified ──────────────────────────
  if (requiresVerification || blockedByApi) {
    return (
      <StatusPanel
        icon="✉️"
        eyebrow="Carrito bloqueado"
        title="Verifica tu correo para continuar"
        text="Aún puedes ver los discos del catálogo, pero necesitas confirmar tu correo para agregar artículos al carrito y pagar. Revisa tu bandeja de entrada o solicita un nuevo enlace."
        actions={
          <>
            <Button tone="orange" className="min-h-[52px] px-7" loading={resendStatus === "sending"} onClick={handleResend}>
              {resendStatus === "sending" ? "Enviando..." : "Reenviar enlace de verificación"}
            </Button>
            <Link to="/perfil" className={secondaryCta}>Ir a mi perfil</Link>
          </>
        }
        footer={resendStatus === "sent" ? "Te reenviamos el enlace. Revisa tu bandeja de entrada." : null}
      />
    );
  }

  // ── Loading (only on initial fetch, not background refetch) ─────────────
  if (isLoading && !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <ListSkeleton rows={3} label="Cargando tu carrito…" />
        </div>
        <Skeleton className="h-96 rounded-[24px] lg:col-span-5" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <StatusPanel
        icon="🔌"
        title="No pudimos cargar tu carrito"
        text="Intenta de nuevo en unos segundos."
        actions={
          <Button tone="navy" className="min-h-[52px] px-7" onClick={() => void refetch()}>
            Reintentar
          </Button>
        }
      />
    );
  }

  // ── Empty cart ──────────────────────────────────────────────────────────
  if ((!cart || items.length === 0) && !presaleOnly) {
    return (
      <StatusPanel
        icon="💿"
        eyebrow="Carrito vacío"
        title="Aún no hay discos girando aquí"
        text={
          hasPresale
            ? `Tienes ${bag[0].presale.title} en preventa sin apartar. Apártalo desde su página, o agrega discos de la tienda para pagar todo junto.`
            : "Explora el catálogo y encuentra tu próximo vinilo favorito."
        }
        actions={
          <>
            {hasPresale ? (
              <Link to={`/preventas/${bag[0].presale.slug}`} className={primaryCta}>
                Apartar mi preventa
              </Link>
            ) : null}
            <Link to="/catalogo" className={hasPresale ? secondaryCta : primaryCta}>
              Explorar el catálogo
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </>
        }
      />
    );
  }

  // ── Cart with items ─────────────────────────────────────────────────────
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const recordsShip = deliveryOption === "home" && items.length > 0 && !(hasPresale && shipTogether === true);
  const recordsTotal = Number(cart?.total_price ?? 0);
  const shippingTotal = recordsShip && shippingQuote ? Number(shippingQuote.selected.total) : 0;
  const presaleMoney = presaleTotals(bag);
  const presaleNow = !hasPresale ? 0 : presalePay === "full" ? presaleMoney.full : presaleMoney.minimum;
  // Presale shipping is charged today only when it's paid in full; otherwise with the last payment.
  const presaleShipNow = presaleHome && presalePay === "full" ? presaleShipping?.amount ?? 0 : 0;
  const presaleLater = hasPresale && presalePay === "min" ? presaleMoney.price - presaleMoney.minimum : 0;
  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">Carrito</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-denim sm:text-4xl">Tu carrito</h1>
          <p className="mt-1.5 text-sm text-navy/75">
            {presaleOnly ? "Tu preventa, lista para apartar" : `${units} ${units === 1 ? "disco listo" : "discos listos"} para girar`}
          </p>
        </div>
        <CheckoutSteps current={deliveryOption ? 1 : 0} />
      </header>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        {/* ── Items ── */}
        <div className="min-w-0 lg:col-span-7">
          {items.length > 0 ? (
          <ul className="divide-y divide-navy/10 overflow-hidden rounded-[24px] border border-navy/10 bg-cream shadow-card">
            {items.map((item, index) => (
              <CartItemRow
                key={item.id}
                item={item}
                index={index}
                isUpdating={actionLoadingId === item.id}
                onUpdateQuantity={(itemId, next) => void handleUpdateQuantity(itemId, next)}
                onRemove={(recordId) => void handleRemoveItem(recordId)}
              />
            ))}
          </ul>
          ) : null}
          {hasPresale ? <CartPresales lines={bag} pay={presalePay} onPay={setPresalePay} /> : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <Link
              to="/catalogo"
              className="group inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-navy transition hover:text-orange"
            >
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:-translate-x-1">←</span>
              Seguir explorando
            </Link>
            {items.length > 0 ? <button
              type="button"
              onClick={() => void handleRemoveAll()}
              disabled={isClearing}
              className="inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-coral underline-offset-4 transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearing && <Spinner />}
              {isClearing ? "Vaciando…" : "Vaciar carrito"}
            </button> : null}
          </div>
        </div>

        {/* ── Summary: stays in view while the list scrolls (desktop) ── */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:col-span-5">
          <div className="overflow-hidden rounded-[24px] border border-navy/10 bg-cream shadow-panel">
            <div className="space-y-4 p-5 sm:p-6">
              <h2 className="font-display text-lg text-denim">Resumen del pedido</h2>

              <fieldset className="space-y-3">
                <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange">
                  ¿Cómo lo recibes?
                </legend>
                <DeliveryOptions
                  value={deliveryOption}
                  onChange={setDeliveryOption}
                  hidden={presaleOnly ? ["bazar"] : undefined}
                />
                {!deliveryOption ? (
                  <p className="text-xs font-semibold text-coral">Selecciona una opción para continuar.</p>
                ) : null}
              </fieldset>

              {/* ── Bazar pickup picker ── */}
              {deliveryOption === "bazar" ? (
                <div className="page-enter space-y-2 rounded-2xl border border-navy/10 bg-white/80 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange">Elige tu bazar</p>
                    <span className="rounded-pill bg-sun px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy">
                      Requerido
                    </span>
                  </div>
                  {bazaresLoading ? (
                    <div className="space-y-2 py-1">
                      <Skeleton className="h-14 w-full rounded-xl" />
                      <Skeleton className="h-14 w-full rounded-xl" />
                    </div>
                  ) : bazaresError ? (
                    <div className="flex items-center justify-between gap-2 py-1">
                      <p className="text-xs text-coral">{bazaresError}</p>
                      <button
                        type="button"
                        onClick={retryFetchBazares}
                        className="min-h-[36px] shrink-0 rounded-pill border border-navy/15 bg-white px-3 text-[11px] font-semibold text-navy transition hover:border-orange hover:text-orange"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : bazares.length === 0 ? (
                    <p className="py-2 text-xs text-navy/75">
                      No hay bazares agendados por ahora. Elige otro método de entrega y nos vemos en la próxima. 🎪
                    </p>
                  ) : (
                    <BazarPicker bazares={bazares} selectedId={selectedBazarId} onSelect={setSelectedBazarId} />
                  )}
                </div>
              ) : null}

              {/* ── Home delivery address form ── */}
              {deliveryOption === "home" ? (
                <div className="page-enter">
                  {/* A real <form>: Enter submits, and checkout reads its FormData. */}
                  <form
                    ref={shippingFormRef}
                    id="shipping-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleCheckout();
                    }}
                    noValidate
                    className="space-y-3 rounded-xl border border-navy/10 bg-white/80 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-orange">Dirección de envío</p>
                      <span className="rounded-pill bg-sun px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy">
                        Requerido
                      </span>
                    </div>
                    <ShippingAddressFields
                      values={shippingAddress}
                      errors={shippingErrors}
                      locations={locations}
                      locationsZip={locationsZip}
                      onChange={handleShippingChange}
                    />
                  </form>
                </div>
              ) : null}

              {presaleHome && !presaleOnly ? (
                <fieldset className="page-enter space-y-2 rounded-2xl border border-orange/30 bg-white/80 p-4">
                  <legend className="sr-only">¿Cómo te enviamos tu preventa y tus discos?</legend>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange">
                    ¿Enviamos todo junto?
                  </p>
                  <div role="radiogroup" className="grid gap-2">
                    {[
                      {
                        value: true,
                        title: "Todo junto, en una caja",
                        text: "Tus discos esperan a que llegue la preventa. Un solo envío."
                      },
                      {
                        value: false,
                        title: "Los discos ahora, la preventa después",
                        text: "Te llegan en dos cajas: pagas dos envíos."
                      }
                    ].map((option) => (
                      <button
                        key={String(option.value)}
                        type="button"
                        role="radio"
                        aria-checked={shipTogether === option.value}
                        onClick={() => setShipTogether(option.value)}
                        className={`min-h-[52px] rounded-2xl border px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
                          shipTogether === option.value
                            ? "border-orange bg-orange/10 shadow-[inset_0_0_0_1px_theme(colors.orange)]"
                            : "border-navy/15 bg-white hover:border-orange/60"
                        }`}
                      >
                        <span className="block font-semibold text-navy">{option.title}</span>
                        <span className="block text-xs text-navy/70">{option.text}</span>
                      </button>
                    ))}
                  </div>
                  {shipTogether === null ? <p className="text-xs font-semibold text-coral">Elige una opción para continuar.</p> : null}
                </fieldset>
              ) : hasPresale && deliveryOption ? (
                <p className="rounded-2xl bg-sun/30 px-4 py-3 text-xs leading-relaxed text-navy">
                  📀 Tu preventa la recoges en la tienda cuando llegue{deliveryOption === "bazar" ? " (no en el bazar)" : ""}, con tu
                  código de preventa.
                </p>
              ) : null}
            </div>

            <div className="space-y-4 border-t border-navy/10 bg-white/60 p-5 sm:p-6">
              <dl className="space-y-2 text-sm">
                {items.length > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-navy/75">
                    Subtotal · {units} {units === 1 ? "disco" : "discos"}
                  </dt>
                  <dd className="font-semibold tabular-nums text-navy">{currency(recordsTotal)}</dd>
                </div>
                ) : null}
                {recordsShip ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-navy/75">{hasPresale ? "Envío de los discos" : "Envío"}</dt>
                    <dd className="text-right font-semibold text-navy">
                      {isQuoting ? (
                        <Skeleton className="ml-auto h-4 w-24" />
                      ) : quoteError ? (
                        <span className="font-normal text-coral">{quoteError}</span>
                      ) : shippingQuote ? (
                        <>
                          <span className="tabular-nums">{currency(shippingQuote.selected.total)}</span>
                          <span className="block text-[11px] font-normal text-navy/75">{shippingQuote.selected.title}</span>
                        </>
                      ) : (
                        <span className="font-normal text-navy/75">Ingresa tu código postal</span>
                      )}
                    </dd>
                  </div>
                ) : deliveryOption && deliveryOption !== "home" ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-navy/75">Entrega</dt>
                    <dd className="font-semibold text-green-700">Sin costo</dd>
                  </div>
                ) : null}
                {hasPresale ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-navy/75">Preventa · {presalePay === "full" ? "pago completo" : "apartado"}</dt>
                    <dd className="font-semibold tabular-nums text-navy">{currency(presaleNow)}</dd>
                  </div>
                ) : null}
                {presaleHome && together !== null ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-navy/75">{together ? "Envío de todo junto" : "Envío de la preventa"}</dt>
                    <dd className="text-right font-semibold text-navy">
                      {presaleShipping?.error ? (
                        <span className="font-normal text-coral">{presaleShipping.error}</span>
                      ) : presaleShipping?.amount == null ? (
                        <span className="font-normal text-navy/75">
                          {presaleZip.length === 5 ? "Cotizando…" : "Ingresa tu código postal"}
                        </span>
                      ) : presalePay === "full" ? (
                        <span className="tabular-nums">{currency(presaleShipping.amount)}</span>
                      ) : (
                        <span className="block text-xs font-normal text-navy/75">
                          Aprox. {currency(presaleShipping.amount)}, se paga al liquidar
                        </span>
                      )}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-end justify-between gap-3 border-t border-navy/10 pt-3">
                  <dt className="font-semibold text-navy">Total</dt>
                  <dd className="font-display text-2xl text-denim sm:text-[1.7rem]">
                    {currency(recordsTotal + shippingTotal + presaleNow + presaleShipNow)}
                  </dd>
                </div>
                {presaleLater > 0 ? (
                  <p className="text-right text-xs text-navy/70">
                    Después liquidas {currency(presaleLater)} de la preventa (120 días)
                  </p>
                ) : null}
              </dl>

              {hasPresale ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-navy/10 bg-white/80 p-3 text-xs leading-relaxed text-navy">
                  <input
                    type="checkbox"
                    checked={presaleTerms}
                    onChange={(e) => setPresaleTerms(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-orange"
                  />
                  <span>
                    {presalePay === "full" ? ARRIVAL_TEXT : DEPOSIT_TEXT}{" "}
                    {presaleOnly
                      ? ""
                      : presaleHome && shipTogether === true
                      ? "Mis discos de la tienda esperan a que llegue la preventa y se envían juntos, con un solo envío."
                      : presaleHome && shipTogether === false
                        ? "Mis discos de la tienda se envían ahora y la preventa cuando llegue: pago dos envíos."
                        : ""}{" "}
                    <Link to="/terminos-y-condiciones#preventa-y-carrito" className="font-semibold underline underline-offset-2 hover:text-orange">
                      Condiciones
                    </Link>
                  </span>
                </label>
              ) : null}

              <Button
                tone="orange"
                className="min-h-[52px] w-full justify-center text-base"
                onClick={() => void handleCheckout()}
                loading={isCheckingOut}
                disabled={checkoutDisabled}
              >
                {isCheckingOut ? "Procesando..." : "Proceder al pago"}
              </Button>

              {noBazaresAvailable ? (
                <p className="text-center text-xs text-coral">
                  No hay bazares disponibles para recoger por ahora. Elige otro método de entrega.
                </p>
              ) : bazarNotSelected && deliveryOption === "bazar" ? (
                <p className="text-center text-xs text-coral">Elige el bazar donde recogerás tu pedido.</p>
              ) : null}

              <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-navy/75">
                <li className="flex items-center gap-1"><span aria-hidden="true">🔒</span> Pago seguro con Stripe</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
    </section>
  );
}

const STEPS = ["Carrito", "Entrega", "Pago"];

/** Where the buyer is: Carrito → Entrega → Pago (Stripe, on its own page). */
function CheckoutSteps({ current }: { current: number }) {
  return (
    <ol aria-label="Pasos de la compra" className="flex items-center gap-2 text-xs font-semibold">
      {STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span
            className={`flex h-7 items-center gap-1.5 rounded-pill px-3 transition-colors duration-300 ${
              i < current
                ? "bg-navy text-cream"
                : i === current
                ? "bg-orange text-charcoal shadow-card"
                : "border border-navy/15 bg-white/60 text-navy/75"
            }`}
          >
            <span aria-hidden="true">{i < current ? "✓" : i + 1}</span>
            {step}
          </span>
          {i < STEPS.length - 1 ? <span aria-hidden="true" className="h-px w-4 bg-navy/20 sm:w-6" /> : null}
        </li>
      ))}
    </ol>
  );
}

export default CartPage;
