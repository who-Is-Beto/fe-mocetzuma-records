import type { ShippingLocation } from "../../app/services/cartService";
import { ADDRESS_FIELDS } from "./addressFields";

export type ShippingAddressValues = {
  fullName: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  reference: string;
};

type ShippingAddressFieldsProps = {
  values: ShippingAddressValues;
  /** Messages to show now, by field (callers decide when a field's error is shown). */
  errors: Partial<Record<keyof ShippingAddressValues, string>>;
  /** Sepomex colonias for the entered ZIP; empty → free-text colonia input. */
  locations: ShippingLocation[];
  locationsZip: string | null;
  onChange: (field: keyof ShippingAddressValues, value: string) => void;
  onBlur?: (field: keyof ShippingAddressValues) => void;
  /** Keeps ids unique when two address forms could be on one page. */
  idPrefix?: string;
};

const inputClass =
  "mt-1 min-h-[44px] w-full rounded-xl border border-navy/15 bg-white px-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-orange aria-[invalid=true]:border-coral";

/**
 * Home-delivery address fields, shared by the cart checkout and presale
 * reservations. Fields only: the caller owns the <form>. Every control has a
 * visible label and its error wired through aria-describedby.
 */
export function ShippingAddressFields({
  values,
  errors,
  locations,
  locationsZip,
  onChange,
  onBlur,
  idPrefix = "shipping"
}: ShippingAddressFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ADDRESS_FIELDS.map((field) => {
        const id = `${idPrefix}-${field.id}`;
        const error = errors[field.id];
        const common = {
          id,
          name: field.id,
          "data-field": field.id,
          autoComplete: field.auto,
          value: values[field.id],
          onBlur: () => onBlur?.(field.id),
          "aria-invalid": error ? true : undefined,
          "aria-describedby": error ? `${id}-error` : undefined,
          className: inputClass
        };
        return (
          <div key={field.id} className={field.wide ? "sm:col-span-2" : ""}>
            <label htmlFor={id} className="text-xs font-semibold text-navy/80">
              {field.label}
              {field.optional ? " (opcional)" : ""}
            </label>
            {field.id === "neighborhood" && locations.length > 0 ? (
              <>
                <select {...common} onChange={(e) => onChange(field.id, e.target.value)}>
                  <option value="">Selecciona tu colonia ({locations.length})</option>
                  {locations.map((loc) => (
                    <option key={loc.neighborhood} value={loc.neighborhood}>
                      {loc.neighborhood}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-navy/50">Colonias oficiales para el CP {locationsZip}.</p>
              </>
            ) : (
              <input
                {...common}
                type={field.type ?? "text"}
                inputMode={field.id === "zip" ? "numeric" : undefined}
                maxLength={field.id === "zip" ? 5 : 200}
                onChange={(e) => onChange(field.id, e.target.value)}
              />
            )}
            {error ? (
              <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-coral">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
