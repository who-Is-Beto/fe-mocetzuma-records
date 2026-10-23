import { useState } from "react";

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Accessible name, e.g. "Cantidad de Kind of Blue". */
  label: string;
  disabled?: boolean;
};

/**
 * − [n] + with thumb-sized buttons. The field keeps its own draft while
 * typing, so it can be emptied and retyped ("2" stays 2 instead of turning
 * "1" into "12"); focusing selects the number so typing replaces it.
 */
export function QuantityStepper({ value, min, max, onChange, label, disabled = false }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const set = (n: number) => onChange(Math.max(min, Math.min(n, max)));
  const buttonClass =
    "flex h-11 w-11 shrink-0 items-center justify-center text-lg font-semibold text-navy transition hover:bg-orange/10 hover:text-orange active:bg-orange/20 disabled:cursor-not-allowed disabled:text-navy/25 disabled:hover:bg-transparent";

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-navy/15 bg-white focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/30">
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Uno menos (${label})`}
        className={buttonClass}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        value={draft ?? String(value)}
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          if (digits === "") {
            setDraft("");
            return;
          }
          const n = Math.max(min, Math.min(Number(digits), max));
          setDraft(String(n));
          onChange(n);
        }}
        onBlur={() => setDraft(null)}
        className="w-12 min-w-0 border-x border-navy/10 bg-transparent text-center text-sm font-semibold tabular-nums text-navy outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Uno más (${label})`}
        className={buttonClass}
      >
        +
      </button>
    </div>
  );
}
