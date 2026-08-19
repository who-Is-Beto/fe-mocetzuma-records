import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../app/providers/AuthProvider";
import { useServiceQuery } from "../../app/hooks";
import {
  createCartService,
  type CartResponse,
  type ShippingDetails
} from "../../app/services/cartService";
import { HttpError } from "../../app/lib/httpClient";
import { usePageTitle } from "../../app/hooks/usePageTitle";
import { getEffectivePrice } from "../../app/domain/album";

const CART_CODE_KEY = "moctezuma-cart-code";

const getCartCode = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CART_CODE_KEY);
};

const persistCartCode = (code?: string | null) => {
  if (typeof window === "undefined" || !code) return;
  localStorage.setItem(CART_CODE_KEY, code);
};

const currency = (value?: number | string) =>
  typeof value === "string" || typeof value === "number"
    ? Number(value).toLocaleString("es-mx", {
        style: "currency",
        currency: "MXN"
      })
    : "—";

const isVerificationError = (err: unknown) =>
  err instanceof HttpError &&
  err.status === 403 &&
  (err.data as { error?: { code?: string } } | undefined)?.error?.code ===
    "email_not_verified";

const DELIVERY_OPTIONS = [
  {
    key: "store" as const,
    label: "Recoger en tienda",
    helper: "Sin costo, agenda tu visita."
  },
  {
    key: "home" as const,
    label: "Envío a domicilio",
    helper: "Calculamos el envío al pagar."
  },
  {
    key: "bazar" as const,
    label: "Recoger en bazar",
    helper: "Coordina en el próximo evento."
  }
];

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

export function CartPage() {
  usePageTitle("Tu carrito");
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
  const [deliveryOption, setDeliveryOption] = useState<
    "store" | "home" | "bazar" | null
  >(null);
  const [shippingAddress, setShippingAddress] = useState({
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
  const shippingFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (deliveryOption !== "home") {
      setShippingErrors({});
    }
  }, [deliveryOption]);

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

  const refreshCart = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleUpdateQuantity = async (
    itemId: number | string,
    next: number
  ) => {
    if (next < 1) return;
    try {
      await cartService.updateItem(itemId, next);
      refreshCart();
    } catch (err) {
      const message =
        err instanceof HttpError &&
        (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error?: { message?: string } }).error?.message ??
            "No se pudo actualizar el carrito."
          : "No se pudo actualizar el carrito.";
      showToast(message, "error");
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
    (field: keyof typeof shippingAddress, value: string) => {
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

    setIsCheckingOut(true);
    try {
      const { checkout_url } = await cartService.createCheckoutSession(
        cartCode,
        deliveryOption,
        shippingDetails ?? undefined
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
      const message =
        err instanceof HttpError &&
        (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error?: { message?: string } }).error?.message ??
            "No se pudo iniciar el pago."
          : "No se pudo iniciar el pago.";
      showToast(message, "error");
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
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-cream/80 p-3 shadow-card backdrop-blur sm:flex-row sm:items-center sm:gap-4 sm:p-4"
            >
              <Link
                to={`/records/${item.record.slug ?? item.record.id}`}
                className="block h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-navy/10 bg-gradient-to-br from-denim/10 via-cream to-sand/80 shadow-inner sm:h-20 sm:w-20"
              >
                {item.record.cover_image_url ? (
                  <img
                    src={item.record.cover_image_url}
                    alt={item.record.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl">
                    🎵
                  </div>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  to={`/records/${item.record.slug ?? item.record.id}`}
                  className="line-clamp-2 font-display text-base text-denim hover:text-orange sm:text-lg"
                >
                  {item.record.title}
                </Link>
                <p className="truncate text-xs text-navy/70">
                  {item.record.artist?.name ?? "Artista"}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Button
                    tone="outline"
                    className="h-8 w-8 px-0 text-base"
                    onClick={() =>
                      handleUpdateQuantity(item.id, item.quantity - 1)
                    }
                    disabled={item.quantity <= 1}
                    aria-label="Disminuir cantidad"
                  >
                    −
                  </Button>
                  <span className="min-w-[2rem] text-center text-sm font-semibold text-navy">
                    {item.quantity}
                  </span>
                  <Button
                    tone="outline"
                    className="h-8 w-8 px-0 text-base"
                    onClick={() =>
                      handleUpdateQuantity(item.id, item.quantity + 1)
                    }
                    disabled={item.quantity >= item.record.stock}
                    aria-label="Aumentar cantidad"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-navy/10 pt-3 sm:border-0 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:pt-0">
                {(() => {
                  const { original, effective, discount, hasDiscount } = getEffectivePrice(item.record);
                  const unitPrice = effective;
                  return (
                    <div className="flex items-baseline gap-2">
                      <p className="text-lg font-semibold text-denim">
                        {currency(unitPrice * item.quantity)}
                      </p>
                      {hasDiscount && (
                        <>
                          <span className="text-sm text-navy/40 line-through">
                            {currency(original * item.quantity)}
                          </span>
                          <span className="rounded-full bg-coral/10 px-1.5 py-0.5 text-[10px] font-bold text-coral">
                            -{discount}%
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.record.id)}
                  className="font-semibold text-coral underline text-sm underline-offset-2 transition hover:text-navy"
                >
                  Quitar del Carrito
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-2xl border border-navy/10 bg-cream/80 px-3 py-3 shadow-card sm:px-4">
            <p className="text-sm text-navy/70">
              {items.length} {items.length === 1 ? "artículo" : "artículos"}
            </p>
            <button
              type="button"
              onClick={handleRemoveAll}
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
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
                {DELIVERY_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setDeliveryOption(option.key)}
                    className={`flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left text-xs font-semibold shadow-card transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
                      deliveryOption === option.key
                        ? "border-orange bg-white text-denim"
                        : "border-navy/10 bg-white/80 text-navy"
                    }`}
                  >
                    <span>{option.label}</span>
                    <span className="text-[11px] font-normal text-navy/70">
                      {option.helper}
                    </span>
                  </button>
                ))}
              </div>
              {!deliveryOption ? (
                <p className="text-[11px] font-semibold text-coral">
                  Selecciona una opción para continuar.
                </p>
              ) : null}
              {deliveryOption === "home" ? (
                <form
                  ref={shippingFormRef}
                  id="shipping-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleCheckout();
                  }}
                  className="space-y-2 rounded-xl border border-navy/10 bg-white/80 p-3 shadow-inner"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-orange">
                      Dirección de envío
                    </p>
                    <span className="rounded-pill bg-sun px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy">
                      Requerido
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        value={shippingAddress.fullName}
                        onChange={(e) =>
                          handleShippingChange("fullName", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                      />
                      {shippingErrors.fullName ? (
                        <p className="text-[11px] text-coral">
                          {shippingErrors.fullName}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={shippingAddress.phone}
                        onChange={(e) =>
                          handleShippingChange("phone", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                      />
                      {shippingErrors.phone ? (
                        <p className="text-[11px] text-coral">
                          {shippingErrors.phone}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[2fr,1fr]">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                        Calle
                      </label>
                      <input
                        type="text"
                        name="street"
                        value={shippingAddress.street}
                        onChange={(e) =>
                          handleShippingChange("street", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                      />
                      {shippingErrors.street ? (
                        <p className="text-[11px] text-coral">
                          {shippingErrors.street}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                        Número
                      </label>
                      <input
                        type="text"
                        name="number"
                        value={shippingAddress.number}
                        onChange={(e) =>
                          handleShippingChange("number", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                      />
                      {shippingErrors.number ? (
                        <p className="text-[11px] text-coral">
                          {shippingErrors.number}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                        Colonia / Barrio
                      </label>
                      <input
                        type="text"
                        name="neighborhood"
                        value={shippingAddress.neighborhood}
                        onChange={(e) =>
                          handleShippingChange("neighborhood", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                      />
                      {shippingErrors.neighborhood ? (
                        <p className="text-[11px] text-coral">
                          {shippingErrors.neighborhood}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                        Ciudad
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={shippingAddress.city}
                        onChange={(e) =>
                          handleShippingChange("city", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                      />
                      {shippingErrors.city ? (
                        <p className="text-[11px] text-coral">
                          {shippingErrors.city}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                        Estado
                      </label>
                      <input
                        type="text"
                        name="state"
                        value={shippingAddress.state}
                        onChange={(e) =>
                          handleShippingChange("state", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                      />
                      {shippingErrors.state ? (
                        <p className="text-[11px] text-coral">
                          {shippingErrors.state}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                        Código postal
                      </label>
                      <input
                        type="text"
                        name="zip"
                        value={shippingAddress.zip}
                        onChange={(e) =>
                          handleShippingChange("zip", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                      />
                      {shippingErrors.zip ? (
                        <p className="text-[11px] text-coral">
                          {shippingErrors.zip}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                      Referencias (opcional)
                    </label>
                    <input
                      type="text"
                      name="reference"
                      value={shippingAddress.reference}
                      onChange={(e) =>
                        handleShippingChange("reference", e.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                    />
                  </div>
                </form>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-navy/10 pt-3">
            <span className="text-sm font-semibold text-navy">Total</span>
            <span className="font-display text-2xl text-denim">
              {currency(cart.total_price)}
            </span>
          </div>
          <Button
            tone="orange"
            className="w-full justify-center py-3"
            onClick={() => void handleCheckout()}
            disabled={!deliveryOption || isCheckingOut}
          >
            {isCheckingOut ? "Procesando..." : "Proceder al pago"}
          </Button>
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
