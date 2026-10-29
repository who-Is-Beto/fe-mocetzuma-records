import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { SuccessCheck } from "../../components/SuccessCheck";
import { ListSkeleton, Skeleton } from "../../components/Skeleton";
import { StatusPanel } from "../../components/StatusPanel";
import { primaryCta, secondaryCta } from "../../components/cta";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../app/providers/AuthProvider";
import { useOrders } from "../../app/hooks";
import { isVerificationError } from "../../app/lib/httpClient";
import { useSeo } from "../../app/hooks/useSeo";
import { createCartService } from "../../app/services/cartService";
import { currency } from "../../app/lib/format";
import { statusLabel, DELIVERY_LABELS, type OrderItem, type OrderStatus } from "../../app/domain/orders";
import { PickupBazarInfo } from "./PickupBazarInfo";
import { isHttpUrl } from "../../app/lib/url";
import { Img } from "../../components/Img";

export function OrdersPage() {
  useSeo({ title: "Mis órdenes", noindex: true });
  const { token, isAuthenticated, emailVerified, user, resendVerification } =
    useAuth();
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  // Back from Stripe Checkout (?session_id=): celebrate once, above the list.
  const [justPurchased] = useState(() => new URLSearchParams(window.location.search).has("session_id"));
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent"
  >("idle");
  const [openOrderId, setOpenOrderId] = useState<string | number | null>(null);

  const showToast = (message: string, tone: "error" | "success") => {
    setToast({ message, tone });
  };

  // `null` (legacy session before email_verified existed) counts as unverified.
  const requiresVerification = isAuthenticated && emailVerified !== true;
  // Set by a real backend rejection (403 + email_not_verified), mirroring the
  // old fetchOrders catch. Once blocked, queries stop and the section shows
  // the verification screen again.
  const [blockedByApi, setBlockedByApi] = useState(false);
  const canFetchOrders =
    isAuthenticated && !requiresVerification && !blockedByApi && Boolean(token);

  const { orders, isLoading, isError, rawError, refetch } = useOrders({
    token,
    enabled: canFetchOrders
  });

  useEffect(() => {
    if (isVerificationError(rawError)) setBlockedByApi(true);
  }, [rawError]);

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
      <StatusPanel
        icon="📦"
        eyebrow="Compras"
        title="Inicia sesión para ver tus órdenes"
        text="Aquí sigues cada pedido: del pago a tu tornamesa."
        actions={<Link to="/login" className={primaryCta}>Iniciar sesión</Link>}
      />
    );
  }

  if (requiresVerification || blockedByApi) {
    return (
      <StatusPanel
        icon="✉️"
        eyebrow="Acceso bloqueado"
        title="Verifica tu correo para ver tus órdenes"
        text="Confirma tu correo para acceder a tu historial de compras."
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <ListSkeleton rows={3} label="Cargando tus órdenes…" />
      </div>
    );
  }

  if (isError) {
    return (
      <StatusPanel
        icon="🔌"
        title="No pudimos cargar tus órdenes"
        text="Intenta de nuevo en unos segundos."
        actions={
          <Button tone="navy" className="min-h-[52px] px-7" onClick={() => void refetch()}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (orders.length === 0) {
    return (
      <StatusPanel
        icon="💿"
        eyebrow="Mis órdenes"
        title="Aún no tienes órdenes"
        text="Cuando hagas tu primera compra, aquí verás su estado paso a paso."
        actions={
          <Link to="/catalogo" className={primaryCta}>
            Explorar el catálogo
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        }
      />
    );
  }

  const active = orders.filter((o) => o.status === "paid" || o.status === "shipped").length;

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">Compras</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-denim sm:text-4xl">Mis órdenes</h1>
        </div>
        <dl className="flex gap-2 text-xs">
          <div className="rounded-pill border border-navy/10 bg-cream px-3.5 py-1.5 shadow-sm">
            <dt className="sr-only">Órdenes</dt>
            <dd><strong className="text-navy">{orders.length}</strong> <span className="text-navy/75">{orders.length === 1 ? "orden" : "órdenes"}</span></dd>
          </div>
          {active > 0 ? (
            <div className="rounded-pill bg-sun/60 px-3.5 py-1.5">
              <dt className="sr-only">En curso</dt>
              <dd><strong className="text-navy">{active}</strong> <span className="text-navy/80">en curso</span></dd>
            </div>
          ) : null}
        </dl>
      </header>

      {justPurchased && (
        <div
          role="status"
          className="page-enter flex items-center gap-4 rounded-[24px] border border-green-200 bg-green-50 p-5 shadow-card sm:p-6"
        >
          <SuccessCheck className="h-14 w-14" />
          <div>
            <p className="font-display text-lg text-denim sm:text-xl">¡Gracias por tu compra!</p>
            <p className="mt-0.5 text-sm text-green-900/80">
              Tu pago quedó confirmado. Te mandamos el resumen por correo y aquí abajo puedes seguir tu pedido.
            </p>
          </div>
        </div>
      )}

      <ul className="space-y-4">
        {orders.map((order, index) => {
          const open = openOrderId === order.id;
          const items = order.order_items ?? [];
          const isHome = order.shipped_to === "home";
          const units = items.reduce((sum, item) => sum + item.quantity, 0);
          return (
            <li
              key={order.id}
              style={{ "--i": index } as CSSProperties}
              className={`reveal overflow-hidden rounded-[24px] border bg-cream shadow-card transition duration-300 ${
                open ? "border-navy/20 shadow-panel" : "border-navy/10 hover:shadow-panel"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenOrderId(open ? null : order.id)}
                aria-expanded={open}
                aria-controls={`order-${order.id}`}
                className="flex w-full items-center gap-4 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange sm:gap-5 sm:p-5"
              >
                <CoverStack items={items} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-display text-[15px] text-denim sm:text-base">Orden #{order.id}</p>
                    <StatusChip status={order.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-navy/75">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleDateString("es-mx", { day: "numeric", month: "long", year: "numeric" })
                      : "—"}
                    {" · "}
                    {units} {units === 1 ? "disco" : "discos"}
                    {order.shipped_to ? ` · ${DELIVERY_LABELS[order.shipped_to] ?? order.shipped_to}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums text-navy">{currency(order.amount)}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-navy/75">{order.currency}</p>
                </div>
                <span aria-hidden="true" className={`shrink-0 text-navy/60 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </button>

              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <OrderProgress status={order.status} home={isHome} />
              </div>

              <div
                id={`order-${order.id}`}
                className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-4 border-t border-navy/10 bg-white/50 p-4 sm:p-5">
                    <ul className="divide-y divide-navy/10 rounded-2xl border border-navy/10 bg-white/80">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 p-3">
                          {item.record?.cover_image_url ? (
                            <Img
                              src={item.record.cover_image_url}
                              thumbs={item.record.cover_thumbs}
                              alt={item.record.title ?? "Disco"}
                              width={56}
                              className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-navy/10"
                            />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-denim/10 via-cream to-sand/80 text-xl" aria-hidden="true">
                              🎵
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            {item.record?.slug ? (
                              <Link to={`/records/${item.record.slug}`} className="block truncate font-display text-sm text-denim transition hover:text-orange">
                                {item.record.title}
                              </Link>
                            ) : (
                              <p className="truncate font-display text-sm text-denim">{item.record?.title ?? "(disco eliminado)"}</p>
                            )}
                            <p className="truncate text-xs text-navy/75">{item.record?.artist?.name ?? ""}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums text-navy">{currency(item.price)}</p>
                            <p className="text-[11px] text-navy/75">× {item.quantity}</p>
                          </div>
                        </li>
                      ))}
                    </ul>

                    {order.shipping_link ? (
                      isHttpUrl(order.shipping_link) ? (
                        <a
                          href={order.shipping_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${primaryCta} min-h-[48px] w-full sm:w-auto`}
                        >
                          Rastrear mi envío
                          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">↗</span>
                        </a>
                      ) : (
                        <p className="rounded-2xl border border-navy/10 bg-white/80 p-3 text-sm text-navy">
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-orange">Número de guía</span>
                          <span className="mt-0.5 block break-all font-semibold">{order.shipping_link}</span>
                        </p>
                      )
                    ) : null}

                    {order.pickup_bazar ? <PickupBazarInfo bazar={order.pickup_bazar} /> : null}

                    {isHome && order.shipping_details ? (
                      <div className="rounded-2xl border border-navy/10 bg-white/80 p-4 text-sm text-navy/80">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange">Dirección de envío</p>
                        <p className="font-semibold text-navy">{order.shipping_details.fullName}</p>
                        <p>
                          {order.shipping_details.street} {order.shipping_details.number}, {order.shipping_details.neighborhood}
                        </p>
                        <p>
                          {order.shipping_details.city}, {order.shipping_details.state} · CP {order.shipping_details.zip}
                        </p>
                        {order.shipping_details.reference ? <p>Ref: {order.shipping_details.reference}</p> : null}
                        {order.shipping_details.phone ? <p>Tel: {order.shipping_details.phone}</p> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
    </section>
  );
}

/** Up to three covers fanned like sleeves in a crate; "+n" for the rest. */
function CoverStack({ items }: { items: OrderItem[] }) {
  const shown = items.slice(0, 3);
  const rest = items.length - shown.length;
  return (
    <div className="relative flex shrink-0 items-center">
      {shown.map((item, i) => (
        <span
          key={item.id}
          className={`block h-12 w-12 overflow-hidden rounded-lg bg-sand shadow-card ring-2 ring-cream sm:h-14 sm:w-14 ${i ? "-ml-7 sm:-ml-8" : ""}`}
          style={{ zIndex: shown.length - i, transform: `rotate(${(i - 1) * 4}deg)` }}
        >
          {item.record?.cover_image_url ? (
            <Img src={item.record.cover_image_url} thumbs={item.record.cover_thumbs} alt="" width={56} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-lg" aria-hidden="true">🎵</span>
          )}
        </span>
      ))}
      {rest > 0 ? (
        <span className="absolute -bottom-1 -right-1 z-10 rounded-pill bg-navy px-1.5 py-0.5 text-[10px] font-bold text-cream shadow">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-navy/10 text-navy",
  paid: "bg-sun/70 text-navy",
  shipped: "bg-chart-1/15 text-denim",
  delivered: "bg-green-100 text-green-800",
  canceled: "bg-coral/15 text-coral"
};

function StatusChip({ status }: { status: OrderStatus }) {
  return (
    <span className={`rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status] ?? STATUS_TONE.pending}`}>
      {statusLabel[status] ?? status}
    </span>
  );
}

/**
 * Where the order is, as a track: Pagada → Enviada → Entregada for home
 * delivery, Pagada → Entregada for pickups. Pending/canceled get a sentence.
 */
function OrderProgress({ status, home }: { status: OrderStatus; home: boolean }) {
  if (status === "pending") {
    return <p className="text-xs text-navy/75">Esperando la confirmación del pago.</p>;
  }
  if (status === "canceled") {
    return <p className="text-xs text-coral">Esta orden fue cancelada.</p>;
  }
  const steps = home
    ? [
        { key: "paid", label: "Pagada" },
        { key: "shipped", label: "Enviada" },
        { key: "delivered", label: "Entregada" }
      ]
    : [
        { key: "paid", label: "Pagada" },
        { key: "delivered", label: "Entregada" }
      ];
  // A pickup order is never "shipped": treat it as still paid.
  const reached = Math.max(0, steps.findIndex((s) => s.key === status));
  const progress = steps.length > 1 ? (reached / (steps.length - 1)) * 100 : 100;

  return (
    <div role="img" aria-label={`Estado: ${steps[reached].label}`} className="relative max-w-md">
      <div className="absolute left-3 right-3 top-3 h-1 rounded-full bg-navy/10" aria-hidden="true">
        <div className="grow-x h-full rounded-full bg-gradient-to-r from-orange to-amber" style={{ width: `${progress}%` }} />
      </div>
      <ol className="relative flex justify-between">
        {steps.map((step, i) => {
          const done = i <= reached;
          return (
            <li key={step.key} className="flex flex-col items-center gap-1.5" aria-hidden="true">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-4 ring-cream transition-colors duration-500 ${
                  done ? "bg-orange text-charcoal" : "bg-white text-navy/60 ring-offset-0"
                } ${i === reached && status !== "delivered" ? "shadow-[0_0_0_6px_rgba(244,144,60,0.18)]" : ""}`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`text-[11px] font-semibold ${done ? "text-navy" : "text-navy/60"}`}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default OrdersPage;
