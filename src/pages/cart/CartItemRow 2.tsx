import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { currency } from "../../app/lib/format";
import { getEffectivePrice } from "../../app/domain/album";
import type { CartItem } from "../../app/services/cartService";

type CartItemRowProps = {
  item: CartItem;
  onUpdateQuantity: (itemId: number | string, next: number) => void;
  onRemove: (recordId: string) => void;
};

/**
 * One record in the cart list: cover, title link, quantity stepper and
 * price with discount badge.
 */
export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const detailHref = `/records/${item.record.slug ?? item.record.id}`;
  const { original, effective, discount, hasDiscount } = getEffectivePrice(item.record);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-cream/80 p-3 shadow-card backdrop-blur sm:flex-row sm:items-center sm:gap-4 sm:p-4">
      <Link
        to={detailHref}
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
          to={detailHref}
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
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            disabled={item.quantity <= 1}
            aria-label={`Disminuir cantidad de ${item.record.title}`}
          >
            −
          </Button>
          <span className="min-w-[2rem] text-center text-sm font-semibold text-navy">
            {item.quantity}
          </span>
          <Button
            tone="outline"
            className="h-8 w-8 px-0 text-base"
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            disabled={item.quantity >= item.record.stock}
            aria-label={`Aumentar cantidad de ${item.record.title}`}
          >
            +
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-navy/10 pt-3 sm:border-0 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:pt-0">
        <div className="flex items-baseline gap-2">
          <p className="text-lg font-semibold text-denim">
            {currency(effective * item.quantity)}
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
        <button
          type="button"
          onClick={() => onRemove(item.record.id)}
          className="font-semibold text-coral underline text-sm underline-offset-2 transition hover:text-navy"
        >
          Quitar del Carrito
        </button>
      </div>
    </div>
  );
}
