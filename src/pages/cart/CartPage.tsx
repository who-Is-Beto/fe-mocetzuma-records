import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../app/providers/AuthProvider";
import { useServiceQuery } from "../../app/hooks";
import { useSeo } from "../../app/hooks/useSeo";
import { useUpcomingBazares } from "../../app/hooks/useUpcomingBazares";
import {
  createCartService,
  type CartResponse,
  type ShippingDetails,
  type ShippingLocation,
  type ShippingQuoteResponse
} from "../../app/services/cartService";
import { HttpError, extractErrorMessage } from "../../app/lib/httpClient";
import type { DeliveryOptionKey } from "./DeliveryOptions";
import { DeliveryOptions } from "./DeliveryOptions";
import { BazarPicker } from "./BazarPicker";
import { CartItemRow } from "./CartItemRow";
import {
  ShippingAddressFields,
  type ShippingAddressValues
} from "./ShippingAddressFields";
import { currency } from "../../app/lib/format";

const CART_CODE_KEY = "moctezuma-cart-code";

const getCartCode = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CART_CODE_KEY);
};

const persistCartCode = (code?: string | null) => {
  if (typeof window === "undefined" || !code) return;
  localStorage.setItem(CART_CODE_KEY, code);
};

const isVerificationError = (err: unknown) =>
  err instanceof HttpError &&
  err.status === 403 &&
  (err.data as { error?: { code?: string } } | undefined)?.error?.code ===
    "email_not_verified";

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
  const navigate = useNavigate();
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
  const [shippingQuote, setShippingQuote] =
    useState<ShippingQuoteResponse | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
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
  // The final charge is always re-quoted server-side at checkout.
  useEffect(() => {
    if (deliveryOption !== "home" || !cartCode) {
      setShippingQuote(null);
      setQuoteError(null);
      return;
    }
    const zip = shippingAddress.zip.trim();
    if (!/^\d{5}$/.test(zip)) {
      setShippingQuote(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setIsQuoting(true);
    const timer = setTimeout(() => {
      cartService
        .quoteShipping(cartCode, zip)
        .then((quote) => {
          if (cancelled) return;
          setShippingQuote(quote);
          setQuoteError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setShippingQuote(null);
          setQuoteError(
            "No pudimos calcular el envío a ese código postal."
          );
        })
        .finally(() => {
          if (!cancelled) setIsQuoting(false);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    deliveryOption,
    cartCode,
    cartService,
    shippingAddress.zip,
    cartSignature
  ]);

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
    try {
      await cartService.updateItem(itemId, next);
      refreshCart();
    } catch (err) {
      showToast(extractErrorMessage(err, "No se pudo actualizar el carrito."), "error");
    }
  };

  const handleRemoveItem = async (recordId: string) => {
    if (!cartCode) return;
    try {
      await cartService.removeItem(cartCode, recordId);
      refreshCart();
    } catch (err) {
      if (isVerificationError(err)) {
        setBlockedByApi(true);
        return;
      }
      showToast("No se pudo quitar el artículo.", "error");
    }
  };

  const handleRemoveAll = async () => {
    if (!cartCode) return;
    try {
      await cartService.removeAll(cartCode);
      refreshCart();
    } catch (err) {
      if (isVerificationError(err)) {
        setBlockedByApi(true);
        return;
      }
      showToast("No se pudo vaciar el carrito.", "error");
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
      <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sun/60 text-3xl shadow-inner">
          🛒
        </div>
        <header className="space-y-2">
          <h1 className="font-display text-3xl text-denim">Tu carrito</h1>
          <p className="mx-auto max-w-md text-sm text-navy/70">
            Inicia sesión para ver tu carrito y continuar con tu compra.
          </p>
        </header>
        <Button tone="orange" onClick={() => navigate("/login")}>
          Iniciar sesión
        </Button>
      </section>
    );
  }

  // ── Gate: authenticated but email not verified ──────────────────────────
  if (requiresVerification || blockedByApi) {
    return (
      <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange/20 text-3xl shadow-inner">
          ✉️
        </div>
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-orange">
            Carrito bloqueado
          </p>
          <h1 className="font-display text-3xl text-denim">
            Verifica tu correo para continuar
          </h1>
          <p className="mx-auto max-w-md text-sm text-navy/70">
            Aún puedes ver los discos del catálogo, pero necesitas confirmar tu
            correo para agregar artículos al carrito y pagar. Revisa tu bandeja
            de entrada o solicita un nuevo enlace.
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            tone="orange"
            disabled={resendStatus === "sending"}
            onClick={handleResend}
          >
            {resendStatus === "sending"
              ? "Enviando..."
              : "Reenviar enlace de verificación"}
          </Button>
          <Button tone="outline" onClick={() => navigate("/perfil")}>
            Ir a mi perfil
          </Button>
        </div>

        {resendStatus === "sent" ? (
          <p className="text-sm font-semibold text-denim">
            Te reenviamos el enlace. Revisa tu bandeja de entrada.
          </p>
        ) : null}
      </section>
    );
  }

  // ── Loading (only on initial fetch, not background refetch) ─────────────
  if (isLoading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <section className="space-y-4 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
        <h1 className="font-display text-2xl text-denim">
          No pudimos cargar tu carrito
        </h1>
        <p className="text-sm text-navy/70">Intenta de nuevo en unos segundos.</p>
        <Button tone="navy" onClick={() => void refetch()}>
          Reintentar
        </Button>
      </section>
    );
  }

  // ── Empty cart ──────────────────────────────────────────────────────────
  if (!cart || items.length === 0) {
    return (
      <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sun/60 text-3xl shadow-inner">
          🛒
        </div>
        <header className="space-y-2">
          <h1 className="font-display text-3xl text-denim">
            Tu carrito está vacío
          </h1>
          <p className="mx-auto max-w-md text-sm text-navy/70">
            Explora el catálogo y encuentra tu próximo vinilo favorito.
          </p>
        </header>
        <Link
          to="/"
          className="inline-block rounded-pill border border-orange/60 bg-orange px-5 py-2.5 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
        >
          Ir al catálogo
        </Link>
      </section>
    );
  }

  // ── Cart with items ─────────────────────────────────────────────────────
  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">
          Carrito
        </p>
        <h1 className="font-display text-3xl text-denim">Tu carrito</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.2fr,0.85fr]">
        <div className="min-w-0 space-y-3">
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onUpdateQuantity={(itemId, next) =>
                void handleUpdateQuantity(itemId, next)
              }
              onRemove={(recordId) => void handleRemoveItem(recordId)}
            />
          ))}

          <div className="flex items-center justify-between rounded-2xl border border-navy/10 bg-cream/80 px-3 py-3 shadow-card sm:px-4">
            <p className="text-sm text-navy/70">
              {items.length} {items.length === 1 ? "artículo" : "artículos"}
            </p>
            <button
              type="button"
              onClick={() => void handleRemoveAll()}
              className="text-xs font-semibold text-coral underline underline-offset-2 transition hover:text-navy"
            >
              Vaciar carrito
            </button>
          </div>
        </div>

        <aside className="min-w-0 h-fit space-y-4 overflow-hidden rounded-2xl border border-navy/10 bg-cream/80 p-5 shadow-panel backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-orange">
              Resumen
            </p>
            <div className="mt-2 space-y-2 rounded-2xl border border-navy/10 bg-cream/70 p-3 shadow-inner">
              <p className="text-[11px] uppercase tracking-[0.14em] text-orange">
                Método de entrega
              </p>
              <DeliveryOptions
                value={deliveryOption}
                onChange={setDeliveryOption}
              />
              {!deliveryOption ? (
                <p className="text-[11px] font-semibold text-coral">
                  Selecciona una opción para continuar.
                </p>
              ) : null}

              {/* ── Bazar pickup picker ── */}
              {deliveryOption === "bazar" ? (
                <div className="space-y-2 rounded-xl border border-navy/10 bg-white/80 p-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-orange">
                      Elige tu bazar
                    </p>
                    <span className="rounded-pill bg-sun px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy">
                      Requerido
                    </span>
                  </div>

                  {bazaresLoading ? (
                    <p className="py-2 text-xs text-navy/60">Cargando bazares...</p>
                  ) : bazaresError ? (
                    <div className="flex items-center justify-between gap-2 py-1">
                      <p className="text-xs text-coral">{bazaresError}</p>
                      <button
                        type="button"
                        onClick={retryFetchBazares}
                        className="shrink-0 rounded-pill border border-navy/15 bg-white px-3 py-1 text-[11px] font-semibold text-navy transition hover:border-orange hover:bg-orange hover:text-white"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : bazares.length === 0 ? (
                    <p className="py-2 text-xs text-navy/60">
                      No hay bazares agendados por ahora. Elige otro método de
                      entrega y nos vemos en la próxima. 🎪
                    </p>
                  ) : (
                    <BazarPicker
                      bazares={bazares}
                      selectedId={selectedBazarId}
                      onSelect={setSelectedBazarId}
                    />
                  )}
                </div>
              ) : null}

              {/* ── Home delivery address form ── */}
              {deliveryOption === "home" ? (
                <ShippingAddressFields
                  formRef={shippingFormRef}
                  values={shippingAddress}
                  errors={shippingErrors}
                  locations={locations}
                  locationsZip={locationsZip}
                  onChange={handleShippingChange}
                  onSubmit={() => void handleCheckout()}
                />
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-navy/10 pt-3">
            <span className="text-sm font-semibold text-navy">Subtotal</span>
            <span className="text-sm text-navy">
              {currency(cart.total_price)}
            </span>
          </div>

          {deliveryOption === "home" ? (
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-navy">Envío</span>
              <span className="text-right text-sm text-navy">
                {isQuoting
                  ? "Calculando…"
                  : quoteError
                    ? quoteError
                    : shippingQuote
                      ? `${currency(shippingQuote.selected.total)} · ${shippingQuote.selected.title}`
                      : "Ingresa tu código postal"}
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-navy/10 pt-3">
            <span className="text-sm font-semibold text-navy">Total</span>
            <span className="font-display text-2xl text-denim">
              {currency(
                Number(cart.total_price) +
                  (deliveryOption === "home" && shippingQuote
                    ? Number(shippingQuote.selected.total)
                    : 0)
              )}
            </span>
          </div>

          <Button
            tone="orange"
            className="w-full justify-center py-3"
            onClick={() => void handleCheckout()}
            disabled={checkoutDisabled}
          >
            {isCheckingOut ? "Procesando..." : "Proceder al pago"}
          </Button>

          {noBazaresAvailable ? (
            <p className="text-center text-[11px] text-coral">
              No hay bazares disponibles para recoger por ahora. Elige otro
              método de entrega.
            </p>
          ) : bazarNotSelected && deliveryOption === "bazar" ? (
            <p className="text-center text-[11px] text-coral">
              Elige el bazar donde recogerás tu pedido.
            </p>
          ) : null}

          <p className="text-center text-[11px] text-navy/60">
            Pago seguro procesado por Stripe.
          </p>
        </aside>
      </div>

      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}
    </section>
  );
}

export default CartPage;
