export type DeliveryOptionKey = "store" | "home" | "bazar";

type DeliveryOption = {
  key: DeliveryOptionKey;
  icon: string;
  label: string;
  helper: string;
};

const OPTIONS: DeliveryOption[] = [
  { key: "home", icon: "📦", label: "Envío a domicilio", helper: "Tarifa real de Estafeta con tu código postal." },
  { key: "store", icon: "🏪", label: "Recoger en tienda", helper: "Sin costo, agenda tu visita." },
  { key: "bazar", icon: "🎪", label: "Recoger en bazar", helper: "Sin costo, en el próximo evento." }
];

type DeliveryOptionsProps = {
  value: DeliveryOptionKey | null;
  onChange: (option: DeliveryOptionKey) => void;
};

/**
 * Radio group (accessible semantics, tabbable buttons) for the three
 * delivery methods offered at checkout: one card per row with its icon.
 */
export function DeliveryOptions({ value, onChange }: DeliveryOptionsProps) {
  return (
    <div role="radiogroup" aria-label="Método de entrega" className="grid gap-2">
      {OPTIONS.map((option) => {
        const selected = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.key)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
              selected
                ? "border-orange bg-white shadow-card"
                : "border-navy/10 bg-white/60 hover:-translate-y-0.5 hover:border-navy/25"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition-colors duration-300 ${
                selected ? "bg-sun/70" : "bg-navy/5"
              }`}
            >
              {option.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-denim">{option.label}</span>
              <span className="block text-[12px] text-navy/75">{option.helper}</span>
            </span>
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                selected ? "border-orange bg-orange" : "border-navy/25 bg-white"
              }`}
            >
              {selected ? <span className="success-pop h-2 w-2 rounded-full bg-white" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
