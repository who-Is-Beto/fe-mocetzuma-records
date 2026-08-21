import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../components/Button";
import {
  http,
  extractErrorMessage
} from "../../app/lib/httpClient";
import { API_BASE_URL } from "../../app/config/api";

/* ── Types (mirror of OrderSerializer) ── */

type AdminOrderItem = {
  id: number | string;
  record?: {
    id: number | string;
    title: string;
    artist?: { name?: string } | null;
  } | null;
  quantity: number;
  price: string | number;
};

type AdminOrder = {
  id: number | string;
  stripe_checkout_session_id: string;
  amount: string | number;
  currency: string;
  user_email: string;
  shipped_to: string;
  shipping_details?: Record<string, string> | null;
  shipping_cost?: string | number | null;
  shipping_courier: string;
  shipping_service: string;
  shipping_link: string;
  status: OrderStatus;
  created_at: string;
  updated_at?: string;
  order_items?: AdminOrderItem[];
};

/* Mirrors Order.status_choices in apiApp/models.py — keep in sync. */
const ORDER_STATUSES = [
  { value: "pending", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregado" },
  { value: "canceled", label: "Cancelado" }
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  canceled: "bg-red-100 text-red-700"
};

const DELIVERY_LABELS: Record<string, string> = {
  store: "Recoger en tienda",
  home: "Envío a domicilio",
  bazar: "Recoger en bazar"
};

const currency = (value?: number | string) =>
  typeof value === "string" || typeof value === "number"
    ? Number(value).toLocaleString("es-mx", {
        style: "currency",
        currency: "MXN"
      })
    : "—";

const withBase = (path: string) =>
  `${API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

/* ── Component ── */

export function ManageOrdersTab() {
  const { token } = useAuth();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Per-order drafts for the tracking link and status; fall back to stored
  // values. Typing a link pre-selects "shipped" but nothing saves until
  // Guardar is pressed.
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, OrderStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  /* ── Fetch orders ── */

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const data = await http<AdminOrder[]>(withBase("/orders/all/"), {
        token,
        signal: controller.signal
      });
      if (!controller.signal.aborted) {
        setOrders(Array.isArray(data) ? data : []);
        setLinkDrafts({});
        setStatusDrafts({});
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setError(extractErrorMessage(err, "Error al cargar los pedidos."));
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
    return () => abortRef.current?.abort();
  }, [fetchOrders]);

  /* ── Updates ── */

  const patchOrder = useCallback(
    async (order: AdminOrder, changes: Partial<Pick<AdminOrder, "status" | "shipping_link">>) => {
      if (!token) return;
      setSavingId(String(order.id));
      setError(null);
      try {
        const updated = await http<AdminOrder>(
          withBase(`/orders/${order.id}/update/`),
          { method: "PATCH", body: changes, token }
        );
        setOrders((prev) =>
          prev.map((o) => (String(o.id) === String(order.id) ? updated : o))
        );
        setLinkDrafts((prev) => {
          const next = { ...prev };
          delete next[String(order.id)];
          return next;
        });
        setStatusDrafts((prev) => {
          const next = { ...prev };
          delete next[String(order.id)];
          return next;
        });
        showToast("Pedido actualizado.");
      } catch (err: unknown) {
        setError(extractErrorMessage(err, "No se pudo actualizar el pedido."));
        setTimeout(() => setError(null), 4000);
      } finally {
        setSavingId(null);
      }
    },
    [token, showToast]
  );

  /* ── Filtering ── */

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        o.user_email.toLowerCase().includes(q) ||
        String(o.id).includes(q) ||
        o.stripe_checkout_session_id.toLowerCase().includes(q) ||
        (o.order_items ?? []).some((item) =>
          item.record?.title.toLowerCase().includes(q)
        )
      );
    });
  }, [orders, search, statusFilter]);

  const linkValueFor = (o: AdminOrder) =>
    linkDrafts[String(o.id)] ?? o.shipping_link ?? "";

  const statusValueFor = (o: AdminOrder): OrderStatus =>
    statusDrafts[String(o.id)] ?? o.status;

  const linkDirty = (o: AdminOrder) =>
    linkValueFor(o) !== (o.shipping_link ?? "");

  const statusDirty = (o: AdminOrder) => statusValueFor(o) !== o.status;

  // Typing a tracking link pre-selects "shipped" for pre-shipment states —
  // never downgrades delivered/canceled, and nothing saves until Guardar.
  const handleLinkChange = (o: AdminOrder, value: string) => {
    setLinkDrafts((prev) => ({ ...prev, [String(o.id)]: value }));
    if (value.trim() && ["pending", "paid"].includes(statusValueFor(o))) {
      setStatusDrafts((prev) => ({ ...prev, [String(o.id)]: "shipped" }));
    }
  };

  /* ── Render ── */

  return (
    <div>
      <h2 className="font-display text-xl sm:text-2xl text-denim">Pedidos</h2>
      <p className="mt-1 text-xs sm:text-sm text-navy/60">
        Consulta y actualiza el estado y el número de rastreo de cada pedido.
      </p>

      {/* ── Search + status filter ── */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por correo, #orden, disco o sesión…"
          className="w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | OrderStatus)
          }
          className="rounded-xl border border-navy/15 bg-white px-3 py-3 text-sm font-semibold text-navy outline-none transition focus:border-orange sm:w-44"
        >
          <option value="all">Todos los estados</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Success ── */}
      {successMessage && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <Button
            tone="outline"
            className="ml-3 px-3 py-1 text-xs"
            onClick={fetchOrders}
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="mt-8 flex justify-center">
          <p className="text-sm text-navy/50 animate-pulse">Cargando…</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && filteredOrders.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg text-navy/40">📦</p>
          <p className="mt-2 text-sm text-navy/50">
            {search.trim() || statusFilter !== "all"
              ? "Ningún pedido coincide con la búsqueda."
              : "Todavía no hay pedidos."}
          </p>
        </div>
      )}

      {/* ── Orders ── */}
      {!loading && filteredOrders.length > 0 && (
        <>
          <p className="mt-4 text-xs text-navy/40">
            {filteredOrders.length} pedido{filteredOrders.length === 1 ? "" : "s"}
          </p>
          <div className="mt-3 space-y-3">
            {filteredOrders.map((o) => {
              const items = o.order_items ?? [];
              const address = o.shipping_details ?? null;
              const draft = linkValueFor(o);
              // Only home deliveries with a captured address can carry a
              // tracking link; store/bazar pickups have nothing to track.
              const isShippable =
                o.shipped_to === "home" && Boolean(o.shipping_details);
              return (
                <div
                  key={o.id}
                  className="rounded-2xl border border-navy/10 bg-white/70 p-3 backdrop-blur sm:p-4"
                >
                  {/* Header row: stacks on mobile */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">
                        Pedido #{o.id} ·{" "}
                        <span className="font-normal text-navy/60">
                          {o.user_email}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-navy/50">
                        {o.created_at
                          ? new Date(o.created_at).toLocaleDateString("es-mx", {
                              day: "numeric",
                              month: "long",
                              year: "numeric"
                            })
                          : "—"}{" "}
                        · {DELIVERY_LABELS[o.shipped_to] ?? o.shipped_to}
                        {o.shipping_cost != null && Number(o.shipping_cost) > 0
                          ? ` · Envío ${currency(o.shipping_cost)} (${o.shipping_courier} ${o.shipping_service})`.trimEnd()
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                      <span className="whitespace-nowrap font-display text-lg text-denim">
                        {currency(o.amount)}
                      </span>
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[o.status] ?? "bg-navy/10 text-navy/60"}`}
                      >
                        {ORDER_STATUSES.find((s) => s.value === o.status)?.label ??
                          o.status}
                      </span>
                    </div>
                  </div>

                  {/* Items + address */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 rounded-xl bg-cream/60 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/50">
                        Discos
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {items.length === 0 ? (
                          <li className="text-xs text-navy/50">—</li>
                        ) : (
                          items.map((item) => (
                            <li
                              key={item.id}
                              className="truncate text-xs text-navy/80"
                            >
                              {item.quantity}× {item.record?.title ?? "(disco eliminado)"}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    {address ? (
                      <div className="min-w-0 rounded-xl bg-cream/60 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/50">
                          Dirección
                        </p>
                        <p className="mt-1 break-words text-xs leading-relaxed text-navy/80">
                          {address.street} {address.number}, {address.neighborhood}
                          <br />
                          {address.city}, {address.state} · CP {address.zip}
                          <br />
                          {address.fullName} · {address.phone}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Controls: status (+ tracking link for shippable orders) */}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="sm:w-44">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/50">
                        Estado
                      </label>
                      <select
                        value={statusValueFor(o)}
                        onChange={(e) => {
                          setStatusDrafts((prev) => ({
                            ...prev,
                            [String(o.id)]: e.target.value as OrderStatus
                          }));
                        }}
                        disabled={savingId === String(o.id)}
                        className={`mt-1 w-full cursor-pointer rounded-lg border border-navy/15 bg-white px-2 py-2 text-xs font-semibold outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30 ${
                          statusDirty(o)
                            ? "border-orange/60 ring-1 ring-orange/40"
                            : ""
                        } ${
                          savingId === String(o.id)
                            ? "cursor-wait opacity-50"
                            : ""
                        }`}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {isShippable ? (
                      <div className="flex-1">
                        <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/50">
                          Link de rastreo
                        </label>
                        <div className="mt-1 flex gap-2">
                          <input
                            type="text"
                            value={draft}
                            onChange={(e) => handleLinkChange(o, e.target.value)}
                            placeholder="URL o código de rastreo (vacío = preparando)"
                            maxLength={255}
                            className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-xs text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
                          />
                          <Button
                            tone="navy"
                            className="shrink-0 px-4 py-2 text-xs"
                            disabled={
                              (!linkDirty(o) && !statusDirty(o)) ||
                              savingId === String(o.id)
                            }
                            onClick={() =>
                              void patchOrder(o, {
                                status: statusValueFor(o),
                                shipping_link: draft.trim()
                              })
                            }
                          >
                            {savingId === String(o.id) ? "…" : "Guardar"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Pickup/bazar orders: no tracking link, but status
                      // changes still need an explicit save.
                      <Button
                        tone="navy"
                        className="shrink-0 px-4 py-2 text-xs"
                        disabled={
                          !statusDirty(o) || savingId === String(o.id)
                        }
                        onClick={() =>
                          void patchOrder(o, { status: statusValueFor(o) })
                        }
                      >
                        {savingId === String(o.id) ? "…" : "Guardar estado"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
