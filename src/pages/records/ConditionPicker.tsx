import { useRef, type KeyboardEvent } from "react";
import { conditionInfo, getEffectivePrice, type RecordCopy } from "../../app/domain/album";
import { currency } from "../../app/lib/format";

type Props = {
  copies: RecordCopy[];
  selectedId: number;
  onSelect: (copy: RecordCopy) => void;
};

/**
 * The same record in several conditions, each with its own price and stock:
 * an accessible radiogroup (arrow keys move between copies in stock).
 */
export function ConditionPicker({ copies, selectedId, onSelect }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const available = copies.filter((c) => c.stock > 0).length;
  const selected = copies.find((c) => c.id === selectedId);
  const info = selected ? conditionInfo(selected.condition) : undefined;

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    for (let i = 1; i <= copies.length; i++) {
      const next = (index + step * i + copies.length) % copies.length;
      if (copies[next].stock > 0) {
        onSelect(copies[next]);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p id="condition-picker-label" className="text-xs uppercase tracking-[0.14em] text-orange">
          Elige la condición
        </p>
        <p className="text-[11px] font-semibold text-navy/50">
          {available === copies.length
            ? `${copies.length} copias disponibles`
            : `${available} de ${copies.length} disponibles`}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="condition-picker-label"
        className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {copies.map((copy, index) => {
          const isSelected = copy.id === selectedId;
          const soldOut = copy.stock <= 0;
          const { effective, original, hasDiscount } = getEffectivePrice(copy);
          const label = conditionInfo(copy.condition)?.label ?? copy.condition;
          return (
            <button
              key={copy.id}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={soldOut}
              aria-label={`${label}, ${currency(effective)}, ${soldOut ? "agotado" : `${copy.stock} disponibles`}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => !soldOut && onSelect(copy)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={`relative flex min-h-[76px] flex-col items-start rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/50 ${
                isSelected
                  ? "border-orange bg-sun/30 shadow-sm ring-1 ring-orange"
                  : soldOut
                  ? "cursor-not-allowed border-navy/10 bg-white/40 opacity-60"
                  : "border-navy/15 bg-white hover:-translate-y-0.5 hover:border-orange/60"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-display text-base leading-none text-denim">{copy.condition}</span>
                {isSelected && (
                  <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-orange text-[10px] font-bold text-white">
                    ✓
                  </span>
                )}
              </span>
              <span className="mt-0.5 truncate text-[11px] text-navy/60">{label}</span>
              <span className="mt-auto flex items-baseline gap-1.5 pt-1.5">
                <span className={`text-sm font-semibold tabular-nums ${hasDiscount ? "text-orange" : "text-navy"}`}>
                  {currency(effective)}
                </span>
                {hasDiscount && (
                  <span className="text-[10px] tabular-nums text-navy/40 line-through">{currency(original)}</span>
                )}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${soldOut ? "text-coral" : "text-navy/50"}`}>
                {soldOut ? "Agotado" : copy.stock === 1 ? "Última copia" : `${copy.stock} disponibles`}
              </span>
            </button>
          );
        })}
      </div>
      {info && (
        <p className="mt-2 rounded-lg bg-cream/70 px-3 py-2 text-xs text-navy/70" aria-live="polite">
          <span className="font-semibold text-denim">{info.label}:</span> {info.hint}
        </p>
      )}
    </div>
  );
}
