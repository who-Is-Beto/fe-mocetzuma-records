import { useMemo, useCallback, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../app/providers/AuthProvider";
import { useServiceQuery } from "../../app/hooks";
import {
  createOrdersService,
  type Order
} from "../../app/services/ordersService";
import { HttpError } from "../../app/lib/httpClient";

const currency = (value?: number | string, currencyCode = "MXN") =>
  typeof value === "string" || typeof value === "number"
    ? Number(value).toLocaleString("es-mx", {
        style: "currency",
        currency: currencyCode.toUpperCase()
      })
    : "—";

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleString() : "—";

const isValidUrl = (value?: string | null) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export function OrdersPage() {
  const { token, isAuthenticated, user } = useAuth();
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | number | null>(null);

  const ordersService = useMemo(
    () =>
      createOrdersService({
        getToken: () => token ?? null
      }),
    [token]
  );

  const fetchOrders = useCallback(async () => {
    return ordersService.getOrders();
  }, [ordersService]);

  const { data, isLoading, isError, error, refetch } = useServiceQuery<Order[]>(
    [ordersService, token],
    fetchOrders,
    {
      enabled: Boolean(token)
    }
  );

  const showToast = useCallback(
    (message: string, tone: "error" | "success" = "success") => {
      setToast({ message, tone });
      setTimeout(() => setToast(null), 4500);
    },
    []
  );

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const orders = data ?? [];

  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (error instanceof HttpError) {
      const payload = error.data as
        | { error?: { message?: string } }
        | undefined;
      return payload?.error?.message ?? error.message;
    }
    if (error instanceof Error) return error.message;
    return "No pudimos cargar tus ordenes.";
  }, [error]);

  const toggleOrder = (orderId: string | number) => {
    setOpenOrderId((prev) => (prev === orderId ? null : orderId));
  };

  return (
    <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-5 shadow-panel backdrop-blur md:space-y-6 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-orange">
            Mis ordenes
          </p>
          <h1 className="font-display text-3xl text-denim">
            Tus compras guardadas
          </h1>
          <p className="text-sm text-navy/70">
            Consulta el estado y detalle de tus pedidos.
          </p>
        </div>
        <Button
          tone="outline"
          className="px-3 py-2 text-sm"
          onClick={() =>
            refetch().catch(() => showToast("No pudimos actualizar.", "error"))
          }
          disabled={isLoading}
        >
          {isLoading ? "Actualizando..." : "Actualizar"}
        </Button>
      </header>

      <div className="rounded-2xl border border-navy/10 bg-white/90 p-4 text-sm text-navy shadow-card sm:p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-orange">
          Cuenta activa
        </p>
        <p className="mt-1 font-semibold text-denim break-all">
          {user?.email ?? "Sin correo registrado"}
        </p>
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-coral/30 bg-coral/10 p-4 text-sm text-navy shadow-card">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-denim">Hubo un problema</p>
            <Button
              tone="outline"
              className="px-3 py-1 text-xs"
              onClick={() => refetch()}
            >
              Reintentar
            </Button>
          </div>
          <p className="mt-1 text-navy/80">{errorMessage}</p>
        </div>
      ) : null}

      {!isLoading && !isError && orders.length === 0 ? (
        <div className="rounded-2xl border border-navy/10 bg-white/80 p-5 text-sm text-navy shadow-card">
          <p className="font-semibold text-denim">Sin ordenes</p>
          <p className="text-navy/70">
            Cuando completes un checkout, tus pedidos apareceran aqui.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {orders.map((order) => {
          const isOpen = openOrderId === order.id;
          const orderTotal = currency(order.amount, order.currency ?? "MXN");
          const orderLabel = `Orden ${order.id}`;
          const contentId = `order-details-${order.id}`;
          const shippingEntries = Object.entries(order.shipping_details ?? {});

          return (
            <article
              key={order.id}
              className="rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-card sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-orange">
                    {orderLabel}
                  </p>
                  <p className="text-lg font-semibold text-denim">
                    {orderTotal}
                  </p>
                  <p className="text-xs text-navy/70">
                    {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-pill border border-navy/10 bg-cream px-3 py-1 text-xs font-semibold text-denim shadow-inner">
                    {order.shipped_to === "home"
                      ? "Enviado a domicilio"
                      : order.shipped_to === "store"
                      ? "Recoger en tienda"
                      : "Recoger en bazar"}
                  </span>
                  <span className="rounded-pill bg-sun/70 px-3 py-1 text-xs font-semibold text-navy shadow-inner">
                    {order.status}
                  </span>
                  <Button
                    tone="outline"
                    className="px-3 py-1 text-xs"
                    onClick={() => toggleOrder(order.id)}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                  >
                    {isOpen ? "Ocultar detalles" : "Ver detalles"}
                  </Button>
                </div>
              </div>

              {isOpen ? (
                <div
                  id={contentId}
                  className="mt-4 space-y-4 rounded-2xl border border-navy/10 bg-cream/60 p-4 shadow-inner"
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-navy/10 bg-white/80 p-3 text-sm text-navy shadow-inner">
                      <p className="text-xs uppercase tracking-[0.14em] text-orange">
                        Sesion Stripe
                      </p>
                      <p className="mt-1 break-all text-xs font-semibold text-denim">
                        {order.stripe_checkout_session_id}
                      </p>
                    </div>
                    <div className="rounded-xl border border-navy/10 bg-white/80 p-3 text-sm text-navy shadow-inner">
                      <p className="text-xs uppercase tracking-[0.14em] text-orange">
                        Estado del pedido
                      </p>
                      <p className="mt-1 text-sm font-semibold text-denim">
                        {order.status}
                      </p>
                      <p className="text-xs text-navy/60">
                        Actualizado: {formatDate(order.updated_at)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-navy/10 bg-white/80 p-3 text-sm text-navy shadow-inner">
                    <p className="text-xs uppercase tracking-[0.14em] text-orange">
                      Envio
                    </p>
                    {order.ship_link &&
                      (isValidUrl(order.ship_link) ? (
                        <a
                          href={order.ship_link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-orange underline"
                        >
                          Ver seguimiento
                        </a>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-denim">
                          {order.ship_link}
                        </p>
                      ))}
                    {!order.ship_link && (
                      <p className="mt-1 text-navy/70">
                        Sin enlace de seguimiento.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-navy/10 bg-white/80 p-3 shadow-inner">
                    <p className="text-xs uppercase tracking-[0.14em] text-orange">
                      Articulos
                    </p>
                    <div className="mt-3 space-y-3">
                      {order.order_items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 rounded-xl border border-navy/10 bg-white/90 p-3 shadow-card sm:flex-row sm:items-center"
                        >
                          <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-navy/10 bg-cream shadow-inner">
                              {item.record.cover_image_url ? (
                                <img
                                  src={item.record.cover_image_url}
                                  alt={item.record.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-lg">
                                  🎵
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-[0.14em] text-orange">
                                {item.record.category?.name ?? "Disco"}
                              </p>
                              <p className="font-semibold text-denim break-words leading-tight">
                                {item.record.title}
                              </p>
                              <p className="text-xs text-navy/70">
                                {item.record.artist?.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex w-full justify-between gap-4 text-sm text-navy sm:w-auto sm:justify-end">
                            <div className="text-left sm:text-right">
                              <p className="text-xs uppercase tracking-[0.14em] text-orange">
                                Cantidad
                              </p>
                              <p className="font-semibold text-denim">
                                {item.quantity}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-xs uppercase tracking-[0.14em] text-orange">
                                Precio
                              </p>
                              <p className="font-semibold text-denim">
                                {currency(item.price, order.currency ?? "MXN")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-navy/10 bg-white/80 p-3 text-sm text-navy shadow-inner">
                    <p className="text-xs uppercase tracking-[0.14em] text-orange">
                      Direccion de envio
                    </p>
                    {order.shipped_to !== "home" ? (
                      <p className="mt-1 text-navy/70">
                        Este pedido no requiere direccion de envio.
                      </p>
                    ) : shippingEntries.length > 0 ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {shippingEntries.map(([key, value]) => (
                          <div
                            key={key}
                            className="rounded-lg border border-navy/10 bg-cream/70 px-3 py-2 text-xs shadow-inner"
                          >
                            <p className="text-[11px] uppercase tracking-[0.14em] text-orange">
                              {key.replace(/_/g, " ")}
                            </p>
                            <p className="font-semibold text-denim">
                              {value ? String(value) : "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-navy/70">
                        Sin datos de envio disponibles.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </article>
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
