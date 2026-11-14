import type { ShippingAddressValues } from "./ShippingAddressFields";

type FieldSpec = {
  id: keyof ShippingAddressValues;
  label: string;
  auto: string;
  type?: "text" | "tel";
  wide?: boolean;
  optional?: boolean;
};

// Postal code first: it fills the colonia list, city and state.
export const ADDRESS_FIELDS: FieldSpec[] = [
  { id: "fullName", label: "Nombre de quien recibe", auto: "name", wide: true },
  { id: "phone", label: "Teléfono", auto: "tel", type: "tel" },
  { id: "zip", label: "Código postal", auto: "postal-code" },
  { id: "street", label: "Calle", auto: "address-line1", wide: true },
  { id: "number", label: "Número", auto: "address-line2" },
  { id: "neighborhood", label: "Colonia", auto: "address-level3" },
  { id: "city", label: "Ciudad o alcaldía", auto: "address-level2" },
  { id: "state", label: "Estado", auto: "address-level1" },
  { id: "reference", label: "Referencias", auto: "off", wide: true, optional: true }
];

export const REQUIRED_ADDRESS_FIELDS = ADDRESS_FIELDS.filter((f) => !f.optional);
