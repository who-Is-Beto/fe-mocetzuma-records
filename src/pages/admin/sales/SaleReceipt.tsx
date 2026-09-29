import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PAYMENT_METHOD_LABELS, type Sale } from "../../../app/domain/sales";
import { currency, formatStoreDateTime } from "../../../app/lib/format";

/**
 * Thermal-ticket receipt, built only from the stored sale (snapshotted
 * title/artist/cover, owner, prices), so a reprint always matches the
 * original. Black on white, width from the --receipt-width CSS variable.
 */
export function SaleReceipt({ sale }: { sale: Sale }) {
  const hasCommission = Number(sale.commission_amount) > 0;
  return (
    <div
      className="mx-auto bg-white px-[3mm] py-[4mm] font-body text-[11px] leading-snug text-black"
      style={{ width: "var(--receipt-width)" }}
    >
      <header className="text-center">
        <p className="font-display text-[13px]">Moctezuma Records</p>
        <p className="mt-1">Ticket de venta #{sale.id}</p>
        <p>{formatStoreDateTime(sale.created_at)}</p>
      </header>

      <ul className="mt-2 border-y border-dashed border-black py-1">
        {sale.items.map((item) => (
          <li key={item.id} className="flex gap-2 py-1.5 [break-inside:avoid]">
            {item.cover_image_url ? (
              <img
                src={item.cover_image_url}
                alt=""
                className="h-[12mm] w-[12mm] shrink-0 object-cover grayscale"
              />
            ) : (
              <span className="h-[12mm] w-[12mm] shrink-0 border border-black" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold">{item.title || "(disco eliminado)"}</p>
              {item.artist && <p className="break-words">{item.artist}</p>}
              <p>Dueño: {item.owner?.name ?? "Sin dueño"}</p>
              <p className="flex justify-between gap-2">
                <span>
                  {item.quantity} × {currency(item.price)}
                </span>
                <span className="font-semibold">
                  {currency(Number(item.price) * item.quantity)}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-2 space-y-0.5">
        <div className="flex justify-between">
          <dt>Artículos</dt>
          <dd>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{currency(sale.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Forma de pago</dt>
          <dd>{PAYMENT_METHOD_LABELS[sale.payment_method]}</dd>
        </div>
        {hasCommission && (
          <div className="flex justify-between">
            <dt>Comisión tarjeta ({Number(sale.commission_rate)}%)</dt>
            <dd>−{currency(sale.commission_amount)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-dashed border-black pt-1 text-[13px] font-bold">
          <dt>Total final</dt>
          <dd>{currency(sale.final_sale_price)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-center">¡Gracias por tu compra! 🎶</p>
    </div>
  );
}

/**
 * Prints `sale` once mounted: renders the receipt into a body-level portal
 * (the only thing the print CSS shows), waits for the covers, opens the print
 * dialog and calls `onDone` after it closes. `onDone` must be stable.
 */
export function ReceiptPrinter({ sale, onDone }: { sale: Sale; onDone: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const images = Array.from(rootRef.current?.querySelectorAll("img") ?? []);
    // A broken cover must not block printing.
    void Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(() => {
      if (cancelled) return;
      window.addEventListener("afterprint", onDone, { once: true });
      window.print();
    });
    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", onDone);
    };
  }, [onDone]);

  return createPortal(
    <div ref={rootRef} className="receipt-print-root">
      <SaleReceipt sale={sale} />
    </div>,
    document.body
  );
}
