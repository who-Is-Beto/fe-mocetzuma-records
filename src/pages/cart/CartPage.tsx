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
  const checkoutDisabled =
    !deliveryOption || isCheckingOut || noBazaresAvailable || bazarNotSelected;

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
    enabled: deliveryOption === "home",
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
    if (!cartCode || items.length === 0) return;
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

    setIsCheckingOut(true);
    try {
      const { checkout_url } = await cartService.createCheckoutSession(
        cartCode,
        deliveryOption,
        shippingDetails ?? undefined,
        deliveryOption === "bazar" ? selectedBazarId ?? undefined : undefined
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
  if (!cart || items.length === 0) {
    return (
      <StatusPanel
        icon="💿"
        eyebrow="Carrito vacío"
        title="Aún no hay discos girando aquí"
        text="Explora el catálogo y encuentra tu próximo vinilo favorito."
        actions={
          <Link to="/catalogo" className={primaryCta}>
            Explorar el catálogo
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        }
      />
    );
  }

  // ── Cart with items ─────────────────────────────────────────────────────
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const shippingTotal = deliveryOption === "home" && shippingQuote ? Number(shippingQuote.selected.total) : 0;
  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">Carrito</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-denim sm:text-4xl">Tu carrito</h1>
          <p className="mt-1.5 text-sm text-navy/75">
            {units} {units === 1 ? "disco listo" : "discos listos"} para girar
          </p>
        </div>
        <CheckoutSteps current={deliveryOption ? 1 : 0} />
      </header>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        {/* ── Items ── */}
        <div className="min-w-0 lg:col-span-7">
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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <Link
              to="/catalogo"
              className="group inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-navy transition hover:text-orange"
            >
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:-translate-x-1">←</span>
              Seguir explorando
            </Link>
            <button
              type="button"
              onClick={() => void handleRemoveAll()}
              disabled={isClearing}
              className="inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-coral underline-offset-4 transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearing && <Spinner />}
              {isClearing ? "Vaciando…" : "Vaciar carrito"}
            </button>
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
                <DeliveryOptions value={deliveryOption} onChange={setDeliveryOption} />
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
                  <ShippingAddressFields
                    formRef={shippingFormRef}
                    values={shippingAddress}
                    errors={shippingErrors}
                    locations={locations}
                    locationsZip={locationsZip}
                    onChange={handleShippingChange}
                    onSubmit={() => void handleCheckout()}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-4 border-t border-navy/10 bg-white/60 p-5 sm:p-6">
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-navy/75">
                    Subtotal · {units} {units === 1 ? "disco" : "discos"}
                  </dt>
                  <dd className="font-semibold tabular-nums text-navy">{currency(cart.total_price)}</dd>
                </div>
                {deliveryOption === "home" ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-navy/75">Envío</dt>
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
                ) : deliveryOption ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-navy/75">Entrega</dt>
                    <dd className="font-semibold text-green-700">Sin costo</dd>
                  </div>
                ) : null}
                <div className="flex items-end justify-between gap-3 border-t border-navy/10 pt-3">
                  <dt className="font-semibold text-navy">Total</dt>
                  <dd className="font-display text-2xl text-denim sm:text-[1.7rem]">
                    {currency(Number(cart.total_price) + shippingTotal)}
                  </dd>
                </div>
              </dl>

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
                <li className="flex items-center gap-1"><span aria-hidden="true">🎧</span> Graduación honesta</li>
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
