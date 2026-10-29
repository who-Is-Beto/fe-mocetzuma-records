import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { currency } from "../../app/lib/format";
import { conditionInfo, getEffectivePrice } from "../../app/domain/album";
import type { CartItem } from "../../app/services/cartService";
import { Img } from "../../components/Img";
import { Spinner } from "../../components/Loader";

type CartItemRowProps = {
  item: CartItem;
  /** Position in the list: rows cascade in one after another. */
  index?: number;
  isUpdating?: boolean;
  onUpdateQuantity: (itemId: number | string, next: number) => void;
  onRemove: (recordId: string) => void;
};

const stepButton =
  "flex h-10 w-10 items-center justify-center text-lg text-navy transition hover:text-orange disabled:cursor-not-allowed disabled:text-navy/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange";

/**
 * One record in the cart, built to fit a 320 px phone:
 *
 *   [sleeve+disc]  ARTIST                       (✕)
 *                  Title, up to two lines
 *                  [NM · Near Mint]  Pieza única
 *   ─────────────────────────────────────────────
 *   [ − 1 + ]                         $800.00
 *
 * The title gets the full width; quantity and price share the bottom row.
 * The cover is a sleeve with its disc peeking out (the home hero's motif),
 * sliding further out on hover.
 */
export function CartItemRow({ item, index = 0, isUpdating = false, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const { record } = item;
  const detailHref = `/records/${record.slug ?? record.id}`;
  const { original, effective, discount, hasDiscount } = getEffectivePrice(record);
  const artist = record.artist?.name ?? "Artista";
  const condition = record.condition ? conditionInfo(record.condition) : undefined;
  const atMax = item.quantity >= record.stock;

  return (
    <li
      style={{ "--i": index } as CSSProperties}
      aria-busy={isUpdating || undefined}
      className={`reveal p-4 transition-opacity duration-300 sm:p-5 ${isUpdating ? "pointer-events-none opacity-50" : ""}`}
    >
      <div className="flex gap-4 sm:gap-5">
        {/* Sleeve with its disc: the disc sits in the cover's right padding, so it never covers the text */}
        <Link to={detailHref} className="group relative block w-[5.5rem] shrink-0 pr-3 sm:w-28 sm:pr-4" aria-label={record.title}>
          <span
            aria-hidden="true"
            className="absolute right-0 top-[8%] aspect-square w-[78%] rounded-full shadow-card transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5 group-hover:rotate-[25deg]"
            style={{
              background:
                "radial-gradient(circle, #f4903c 0 17%, #1b1f2a 18% 20%, transparent 21%), repeating-radial-gradient(circle, rgba(255,255,255,0.07) 0 1px, transparent 2px 4px), linear-gradient(135deg, #1b1f2a, #262b38 55%, #000)"
            }}
          />
          <span className="relative block aspect-square overflow-hidden rounded-lg bg-sand shadow-card ring-1 ring-navy/10 transition-transform duration-500 group-hover:-translate-y-0.5">
            {record.cover_image_url ? (
              <Img
                src={record.cover_image_url}
                thumbs={record.cover_thumbs}
                alt=""
                width={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xl" aria-hidden="true">🎵</span>
            )}
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-navy/75">{artist}</p>
              <Link
                to={detailHref}
                className="mt-0.5 line-clamp-2 break-words font-display text-[15px] leading-snug text-denim transition hover:text-orange sm:text-base"
              >
                {record.title}
              </Link>
            </div>
            <button
              type="button"
              onClick={() => onRemove(record.id)}
              disabled={isUpdating}
              aria-label={`Quitar ${record.title} del carrito`}
              title="Quitar del carrito"
              className="-mr-1.5 -mt-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-navy/60 transition hover:bg-coral/10 hover:text-coral focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange disabled:opacity-50"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {record.condition ? (
              <span
                title={condition?.hint}
                className="inline-flex items-center gap-1 rounded-pill border border-navy/10 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-navy/80"
              >
                {record.condition}
                {condition ? <span className="font-medium normal-case tracking-normal text-navy/70">· {condition.label}</span> : null}
              </span>
            ) : null}
            {record.stock === 1 ? (
              <span className="text-[11px] font-semibold text-orange">Pieza única</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Quantity and price share the bottom row, under the whole card */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-dashed border-navy/10 pt-4">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-pill border border-navy/15 bg-white shadow-sm">
            <button
              type="button"
              className={`${stepButton} rounded-l-pill`}
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1 || isUpdating}
              aria-label={`Disminuir cantidad de ${record.title}`}
            >
              −
            </button>
            <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-navy" aria-live="polite">
              {isUpdating ? <Spinner className="mx-auto h-4 w-4" /> : item.quantity}
            </span>
            <button
              type="button"
              className={`${stepButton} rounded-r-pill`}
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              disabled={atMax || isUpdating}
              aria-label={`Aumentar cantidad de ${record.title}`}
            >
              +
            </button>
          </div>
          {atMax && record.stock > 1 ? (
            <span className="hidden text-[11px] text-navy/70 min-[400px]:inline">Máx. {record.stock}</span>
          ) : null}
        </div>

        <div className="min-w-0 text-right">
          <p className="font-display text-lg leading-none text-denim tabular-nums">{currency(effective * item.quantity)}</p>
          {hasDiscount ? (
            <p className="mt-1 flex items-center justify-end gap-1.5 text-[11px]">
              <s className="text-navy/60">{currency(original * item.quantity)}</s>
              <span className="rounded-pill bg-coral/10 px-1.5 font-bold text-coral">-{discount}%</span>
            </p>
          ) : item.quantity > 1 ? (
            <p className="mt-1 text-[11px] text-navy/70">{currency(effective)} c/u</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}
