import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminPresaleOrder } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { useAuth } from "../../app/providers/AuthProvider";
import { createPresaleService } from "../../app/services/presaleService";
import { Button } from "../../components/Button";

/**
 * Pedidos → preventas por enviar: paid presale orders going by mail, next to the
 * regular orders, so shipping happens in one place. The tracking link is saved
 * by marking it shipped (the buyer gets the email with it).
 */
export function PresaleShipments() {
  const { token, hasPerm, role } = useAuth();
  const service = useMemo(() => createPresaleService({ getToken: () => token ?? null }), [token]);
  const canShip = role === "ADMIN" || hasPerm("apiApp.change_order") || hasPerm("apiApp.change_presaleorder");
  const [orders, setOrders] = useState<AdminPresaleOrder[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    service.admin
      .shipments()
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [service]);
  useEffect(load, [load]);

  if (!orders || orders.length === 0) return null;
  const pending = orders.filter((o) => o.status === "pagado");
  const shipped = orders.filter((o) => o.status === "enviado");

  const ship = async (order: AdminPresaleOrder) => {
    setSavingId(order.id);
    setError("");
    try {
      const updated = await service.admin.ship(order.id, (drafts[order.id] ?? "").trim());
      setOrders((list) => (list ?? []).map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudo marcar como enviado."));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section aria-labelledby="presale-shipments" className="mt-5 rounded-2xl border border-orange/30 bg-orange/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="presale-shipments" className="font-semibold text-denim">
          📀 Preventas por enviar
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-orange px-2 py-0.5 text-[11px] font-bold text-charcoal">{pending.length}</span>
          )}
        </h3>
        <p className="text-xs text-navy/60">Pagadas completas con envío a domicilio.</p>
      </div>
      {error && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <ul className="mt-3 space-y-2">
        {[...pending, ...shipped].map((o) => {
          const address = o.shipping_details ?? {};
          const ready = o.status === "pagado" && o.all_arrived && Number(o.balance) === 0 && !o.shipping_pending;
          const draft = drafts[o.id] ?? "";
          return (
            <li key={o.id} className="rounded-xl border border-navy/10 bg-white/80 p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">
                    <span className="font-mono text-orange">{o.code}</span> · {o.buyer_name}
                  </p>
                  <p className="truncate text-xs text-navy/70">{o.lines_label}</p>
                </div>
                <span
                  className={`self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    o.status === "enviado" ? "bg-blue-100 text-blue-700" : ready ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {o.status === "enviado" ? "Enviado" : ready ? "Listo para enviar" : o.all_arrived ? "Falta cotizar o cobrar envío" : "Aún no llega todo"}
                </span>
              </div>
              <p className="mt-2 break-words rounded-lg bg-cream/60 px-3 py-2 text-xs leading-relaxed text-navy/80">
                {[
                  address.fullName,
                  `${address.street ?? ""} ${address.number ?? ""}`.trim(),
                  address.neighborhood,
                  [address.city, address.state].filter(Boolean).join(", "),
                  address.zip ? `CP ${address.zip}` : "",
                  address.phone
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {o.shipping_cost ? ` · Envío ${currency(o.shipping_cost)}${o.shipping_courier ? ` (${o.shipping_courier})` : ""}` : ""}
              </p>
              {o.status === "enviado" ? (
                o.shipping_link ? (
                  <p className="mt-2 truncate text-xs text-navy/70">
                    Guía:{" "}
                    {/^https?:\/\//.test(o.shipping_link) ? (
                      <a href={o.shipping_link} target="_blank" rel="noreferrer" className="font-semibold text-denim underline">
                        {o.shipping_link}
                      </a>
                    ) : (
                      <span className="font-semibold">{o.shipping_link}</span>
                    )}
                  </p>
                ) : null
              ) : (
                canShip && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [o.id]: e.target.value }))}
                      placeholder="URL o código de rastreo"
                      maxLength={255}
                      disabled={!ready}
                      aria-label={`Rastreo de ${o.code}`}
                      className="min-h-[40px] w-full rounded-lg border border-navy/15 bg-white px-3 text-xs text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30 disabled:bg-navy/5"
                    />
                    <Button
                      tone="navy"
                      className="shrink-0 px-4 py-2 text-xs"
                      disabled={!ready || !draft.trim() || savingId === o.id}
                      onClick={() => void ship(o)}
                    >
                      {savingId === o.id ? "…" : "Marcar enviado"}
                    </Button>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
