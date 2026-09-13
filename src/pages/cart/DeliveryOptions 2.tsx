export type DeliveryOptionKey = "store" | "home" | "bazar";

type DeliveryOption = {
  key: DeliveryOptionKey;
  label: string;
  helper: string;
};

const OPTIONS: DeliveryOption[] = [
  { key: "store", label: "Recoger en tienda", helper: "Sin costo, agenda tu visita." },
  { key: "home", label: "Envío a domicilio", helper: "Calculamos el envío con tu código postal." },
  { key: "bazar", label: "Recoger en bazar", helper: "Coordina en el próximo evento." }
];

type DeliveryOptionsProps = {
  value: DeliveryOptionKey | null;
  onChange: (option: DeliveryOptionKey) => void;
};

/**
 * Radio group (accessible semantics, tabbable buttons) for the three
 * delivery methods offered at checkout.
 */
export function DeliveryOptions({ value, onChange }: DeliveryOptionsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Método de entrega"
      className="grid gap-2 grid-cols-1 sm:grid-cols-3"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.key)}
            className={`flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left text-xs font-semibold shadow-card transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
              selected
                ? "border-orange bg-white text-denim"
                : "border-navy/10 bg-white/80 text-navy"
            }`}
          >
            <span>{option.label}</span>
            <span className="text-[11px] font-normal text-navy/70">
              {option.helper}
            </span>
          </button>
        );
      })}
    </div>
  );
}
