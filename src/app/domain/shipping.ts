/**
 * Shipping-domain types shared by the checkout flow (cart page, shipping
 * quote, address form). Previously defined inline in cartService.ts; kept in
 * the domain layer so services and pages share one source of truth.
 */

/** Shipping address collected during checkout. */
export type ShippingDetails = {
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

/** One delivery option returned by POST /shipping/quote/. */
export type ShippingQuote = {
  title: string;
  total: number | string;
  currency: string;
  courier: string;
  serviceType: string;
  deliveryCommitment?: string;
};

/** Full quote response: the selected option plus every courier's options. */
export type ShippingQuoteResponse = {
  zip_code: string;
  subtotal: number | string;
  currency: string;
  selected: ShippingQuote;
  quotes: ShippingQuote[];
};

/** Sepomex colonia data for a ZIP (one ZIP can cover several colonias). */
export type ShippingLocation = {
  zipCode: string;
  neighborhood: string;
  city: string;
  state: string;
};