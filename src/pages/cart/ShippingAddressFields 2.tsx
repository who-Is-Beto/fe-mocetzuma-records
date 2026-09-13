import type { MutableRefObject } from "react";
import type { ShippingLocation } from "../../app/services/cartService";

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
  /** Attached by CartPage to read FormData at checkout time. */
  formRef: MutableRefObject<HTMLFormElement | null>;
  values: ShippingAddressValues;
  errors: Record<string, string>;
  /** Sepomex colonias for the entered ZIP; empty → free-text colonia input. */
  locations: ShippingLocation[];
  locationsZip: string | null;
  onChange: (field: keyof ShippingAddressValues, value: string) => void;
  onSubmit: () => void;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80";

type TextFieldProps = {
  id: keyof ShippingAddressValues;
  label: string;
  type?: "text" | "tel";
  value: string;
  optional?: boolean;
  error?: string;
  onChange: (value: string) => void;
};

/** One labelled input with aria-invalid/describedby wired to its error slot. */
function Field({
  id,
  label,
  type = "text",
  value,
  optional = false,
  error,
  onChange
}: TextFieldProps) {
  const errorId = `shipping-${id}-error`;
  return (
    <div>
      <label htmlFor={`shipping-${id}`} className={labelClass}>
        {label}
        {optional ? " (opcional)" : ""}
      </label>
      <input
        id={`shipping-${id}`}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClass}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-[11px] text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Home-delivery address form (inside the checkout summary). Kept as a real
 * <form> so CartPage can read its FormData on submit; every control is
 * properly labelled for accessibility.
 */
export function ShippingAddressFields({
  formRef,
  values,
  errors,
  locations,
  locationsZip,
  onChange,
  onSubmit
}: ShippingAddressFieldsProps) {
  return (
    <form
      ref={formRef}
      id="shipping-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
      className="space-y-2 rounded-xl border border-navy/10 bg-white/80 p-3 shadow-inner"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.14em] text-orange">
          Dirección de envío
        </p>
        <span className="rounded-pill bg-sun px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy">
          Requerido
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          id="fullName"
          label="Nombre completo"
          value={values.fullName}
          error={errors.fullName}
          onChange={(v) => onChange("fullName", v)}
        />
        <Field
          id="phone"
          label="Teléfono"
          type="tel"
          value={values.phone}
          error={errors.phone}
          onChange={(v) => onChange("phone", v)}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-[2fr,1fr]">
        <Field
          id="street"
          label="Calle"
          value={values.street}
          error={errors.street}
          onChange={(v) => onChange("street", v)}
        />
        <Field
          id="number"
          label="Número"
          value={values.number}
          error={errors.number}
          onChange={(v) => onChange("number", v)}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="shipping-neighborhood" className={labelClass}>
            Colonia / Barrio
          </label>
          {locations.length > 0 ? (
            <>
              <select
                id="shipping-neighborhood"
                name="neighborhood"
                value={values.neighborhood}
                onChange={(e) => onChange("neighborhood", e.target.value)}
                aria-invalid={
                  errors.neighborhood ? true : undefined
                }
                aria-describedby={
                  errors.neighborhood ? "shipping-neighborhood-error" : undefined
                }
                className={inputClass}
              >
                <option value="">
                  Selecciona tu colonia ({locations.length})
                </option>
                {locations.map((loc) => (
                  <option key={loc.neighborhood} value={loc.neighborhood}>
                    {loc.neighborhood}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-navy/40">
                Colonias oficiales para el CP {locationsZip}.
              </p>
            </>
          ) : (
            <input
              id="shipping-neighborhood"
              name="neighborhood"
              type="text"
              value={values.neighborhood}
              onChange={(e) => onChange("neighborhood", e.target.value)}
              aria-invalid={errors.neighborhood ? true : undefined}
              aria-describedby={
                errors.neighborhood ? "shipping-neighborhood-error" : undefined
              }
              className={inputClass}
            />
          )}
          {errors.neighborhood ? (
            <p
              id="shipping-neighborhood-error"
              role="alert"
              className="text-[11px] text-coral"
            >
              {errors.neighborhood}
            </p>
          ) : null}
        </div>
        <Field
          id="city"
          label="Ciudad"
          value={values.city}
          error={errors.city}
          onChange={(v) => onChange("city", v)}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          id="state"
          label="Estado"
          value={values.state}
          error={errors.state}
          onChange={(v) => onChange("state", v)}
        />
        <Field
          id="zip"
          label="Código postal"
          value={values.zip}
          error={errors.zip}
          onChange={(v) => onChange("zip", v)}
        />
      </div>

      <Field
        id="reference"
        label="Referencias"
        optional
        value={values.reference}
        error={errors.reference}
        onChange={(v) => onChange("reference", v)}
      />
    </form>
  );
}
