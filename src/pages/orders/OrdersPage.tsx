import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../app/providers/AuthProvider";
import { useServiceQuery } from "../../app/hooks";
import { http, HttpError } from "../../app/lib/httpClient";
import { API_BASE_URL } from "../../app/config/api";
import { usePageTitle } from "../../app/hooks/usePageTitle";
import { createCartService } from "../../app/services/cartService";

export type OrderItemResponse = {
  id: number | string;
  record?: {
    id: number | string;
    title: string;
    slug?: string;
    cover_image_url?: string | null;
    artist?: { name?: string } | null;
    price: string | number;
  } | null;
  quantity: number;
  price: string | number;
};

export type OrderResponse = {
  id: number | string;
  amount: string | number;
  currency: string;
  user_email: string;
  shipped_to: string;
  shipping_details?: Record<string, string> | null;
  shipping_link: string;
  status: string;
  created_at: string;
  order_items?: OrderItemResponse[];
};

const currency = (value?: number | string) =>
  typeof value === "string" || typeof value === "number"
    ? Number(value).toLocaleString("es-mx", {
        style: "currency",
        currency: "MXN"
      })
    : "—";

// Keys must match Order.status_choices on the backend ("canceled", one L).
const statusLabel: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  shipped: "Enviada",
  delivered: "Entregada",
  canceled: "Cancelada"
};

const DELIVERY_LABELS: Record<string, string> = {
  store: "Recoger en tienda",
  home: "Envío a domicilio",
  bazar: "Recoger en bazar"
};

const isVerificationError = (err: unknown) =>
  err instanceof HttpError &&
  err.status === 403 &&
  (err.data as { error?: { code?: string } } | undefined)?.error?.code ===
    "email_not_verified";

// Only real URLs become clickable; plain tracking codes stay static text.
const isHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

export function OrdersPage() {
  usePageTitle("Mis órdenes");
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
  const [openOrderId, setOpenOrderId] = useState<string | number | null>(null);

  const showToast = (message: string, tone: "error" | "success") => {
    setToast({ message, tone });
  };

  // `null` (legacy session before email_verified existed) counts as unverified.
  const requiresVerification = isAuthenticated && emailVerified !== true;
  const canFetchOrders =
    isAuthenticated && !requiresVerification && !blockedByApi && Boolean(token);

  const fetchOrders = useCallback(async () => {
    if (!canFetchOrders) return [];
    try {
      const data = await http<OrderResponse[]>(
        `${API_BASE_URL}/orders/`,
        { token }
      );
      return data;
    } catch (err) {
      if (isVerificationError(err)) {
        setBlockedByApi(true);
        return [];
      }
      throw err;
    }
  }, [canFetchOrders, token]);

  const { data, isLoading, isError, refetch } = useServiceQuery<
    OrderResponse[]
  >([canFetchOrders, token], fetchOrders, { enabled: canFetchOrders });

  const orders = data ?? [];

  // Returning from Stripe Checkout lands here with ?session_id=... The webhook
  // can't reach a locally-running backend, so ask the server to fulfill the
  // paid session directly (idempotent: it no-ops if the order already exists).
  const cartService = useMemo(
    () => createCartService({ getToken: () => token }),
    [token]
  );
  useEffect(() => {
    if (!canFetchOrders) return;
    const sessionId = new URLSearchParams(window.location.search).get(
      "session_id"
    );
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        await cartService.completeCheckoutSession(sessionId);
      } catch {
        // Not fatal: the webhook may still confirm it later; show orders as-is.
      } finally {
        if (!cancelled) {
          window.history.replaceState({}, "", window.location.pathname);
          void refetch();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canFetchOrders, cartService, refetch]);

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

  if (!isAuthenticated) {
    return (
      <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sun/60 text-3xl shadow-inner">
          📦
        </div>
        <header className="space-y-2">
          <h1 className="font-display text-3xl text-denim">Mis órdenes</h1>
          <p className="mx-auto max-w-md text-sm text-navy/70">
            Inicia sesión para ver tus pedidos.
          </p>
        </header>
        <Button tone="orange" onClick={() => navigate("/login")}>
          Iniciar sesión
        </Button>
      </section>
    );
  }

  if (requiresVerification || blockedByApi) {
    return (
      <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange/20 text-3xl shadow-inner">
          ✉️
        </div>
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-orange">
            Acceso bloqueado
          </p>
          <h1 className="font-display text-3xl text-denim">
            Verifica tu correo para ver tus órdenes
          </h1>
          <p className="mx-auto max-w-md text-sm text-navy/70">
            Confirma tu correo para acceder a tu historial de compras.
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

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (isError) {
    return (
      <section className="space-y-4 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
        <h1 className="font-display text-2xl text-denim">
          No pudimos cargar tus órdenes
        </h1>
        <p className="text-sm text-navy/70">Intenta de nuevo en unos segundos.</p>
        <Button tone="navy" onClick={() => void refetch()}>
          Reintentar
        </Button>
      </section>
    );
  }

  if (orders.length === 0) {
    return (
      <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sun/60 text-3xl shadow-inner">
          📦
        </div>
        <header className="space-y-2">
          <h1 className="font-display text-3xl text-denim">
            Aún no tienes órdenes
          </h1>
          <p className="mx-auto max-w-md text-sm text-navy/70">
            Cuando hagas tu primera compra, aquí verás su estado.
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

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">
          Compras
        </p>
        <h1 className="font-display text-3xl text-denim">Mis órdenes</h1>
      </header>

      <div className="space-y-3">
        {orders.map((order) => {
          const open = openOrderId === order.id;
          const items = order.order_items ?? [];
          const isHome = order.shipped_to === "home";
          return (
            <div
              key={order.id}
              className="overflow-hidden rounded-2xl border border-navy/10 bg-cream/80 shadow-card backdrop-blur"
            >
              <button
                type="button"
                onClick={() => setOpenOrderId(open ? null : order.id)}
                aria-expanded={open}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
              >
                <div className="space-y-1">
                  <p className="font-display text-lg text-denim">
                    {currency(order.amount)}
                    <span className="ml-1 text-xs font-semibold uppercase tracking-[0.12em] text-navy/60">
                      {order.currency}
                    </span>
                  </p>
                  <p className="text-xs text-navy/70">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleDateString("es-mx", {
                          day: "numeric",
                          month: "long",
                          year: "numeric"
                        })
                      : "—"}{" "}
                    · {items.length}{" "}
                    {items.length === 1 ? "artículo" : "artículos"}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  {order.shipping_link ? (
                    isHttpUrl(order.shipping_link) ? (
                      <a
                        href={order.shipping_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={order.shipping_link}
                        className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-pill border border-navy/10 bg-white/80 py-1 pl-3 pr-2 text-xs font-semibold text-denim shadow-sm transition hover:border-orange/50 hover:bg-orange/10"
                      >
                        <span className="truncate">
                          {order.shipping_link}
                        </span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0"
                        >
                          <path d="M15 3h6v6" />
                          <path d="M10 14 21 3" />
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        </svg>
                      </a>
                    ) : (
                      // Plain tracking code (not a URL): show as static pill.
                      <span
                        title={order.shipping_link}
                        className="inline-flex max-w-full min-w-0 items-center rounded-pill border border-navy/10 bg-white/80 px-3 py-1 text-xs font-semibold text-navy shadow-sm"
                      >
                        <span className="truncate">
                          {order.shipping_link}
                        </span>
                      </span>
                    )
                  ) : null}
                  {order.shipped_to ? (
                    <span className="rounded-pill border border-orange/40 bg-orange/10 px-3 py-1 text-xs font-semibold text-denim shadow-sm">
                      {DELIVERY_LABELS[order.shipped_to] ?? order.shipped_to}
                    </span>
                  ) : null}
                  <span className="rounded-pill bg-sun/60 px-3 py-1 text-xs font-semibold text-navy shadow-inner">
                    {statusLabel[order.status] ?? order.status}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`text-navy/50 transition-transform duration-300 ${
                      open ? "rotate-180" : ""
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </div>
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  open
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-2 border-t border-navy/10 px-4 pb-4 pt-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-navy/10 bg-white/80 p-2.5 shadow-inner"
                      >
                        {item.record?.cover_image_url ? (
                          <img
                            src={item.record.cover_image_url}
                            alt={item.record.title ?? "Disco"}
                            className="h-14 w-14 shrink-0 rounded-lg border border-navy/10 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-navy/10 bg-gradient-to-br from-denim/10 via-cream to-sand/80 text-xl">
                            🎵
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-sm text-denim">
                            {item.record?.title ?? "(disco eliminado)"}
                          </p>
                          <p className="truncate text-xs text-navy/70">
                            {item.record?.artist?.name ?? ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-denim">
                            {currency(item.price)}
                          </p>
                          <p className="text-[11px] text-navy/60">
                            × {item.quantity}
                          </p>
                        </div>
                      </div>
                    ))}

                    {isHome && order.shipping_details ? (
                      <div className="rounded-xl border border-navy/10 bg-cream/70 p-3 text-xs text-navy/80 shadow-inner">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange">
                          Dirección de envío
                        </p>
                        <p className="font-semibold text-navy">
                          {order.shipping_details.fullName}
                        </p>
                        <p>
                          {order.shipping_details.street}{" "}
                          {order.shipping_details.number},{" "}
                          {order.shipping_details.neighborhood}
                        </p>
                        <p>
                          {order.shipping_details.city},{" "}
                          {order.shipping_details.state} · CP{" "}
                          {order.shipping_details.zip}
                        </p>
                        {order.shipping_details.reference ? (
                          <p>Ref: {order.shipping_details.reference}</p>
                        ) : null}
                        {order.shipping_details.phone ? (
                          <p>Tel: {order.shipping_details.phone}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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

export default OrdersPage;
