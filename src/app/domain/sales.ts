/**
 * Sales registered by hand in Punto de venta (the "Vender" ticket), the
 * Ventas history and its metrics. Mirrors apiApp/serilizers/orders.py and
 * apiApp/services/sales.py.
 */

import type { Owner } from "./album";

export type PaymentMethod = "cash" | "card" | "transfer";

/** "" = a sale registered before the payment method was recorded. */
export const PAYMENT_METHOD_LABELS: { [method in PaymentMethod | ""]: string } = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  "": "Sin registrar"
};

/** Card commission % the ticket starts with (the backend default too). */
export const DEFAULT_CARD_COMMISSION_RATE = "4.06";

/** One sold record. Title/artist/cover are the sale-time snapshot. */
export type SaleItem = {
  id: number;
  /** null once the record was permanently deleted. */
  record: number | null;
  /** "" only for records deleted before snapshots existed. */
  title: string;
  artist: string;
  cover_image_url: string | null;
  owner: Owner | null;
  quantity: number;
  /** Unit price, decimal string. */
  price: string;
  /** This line's share of the ticket's commission, decimal string. */
  commission_amount: string;
  email_sent: boolean;
};

/** One ticket: everything the printable receipt needs. Money is decimal strings. */
export type Sale = {
  id: number;
  created_at: string;
  payment_method: PaymentMethod | "";
  /** Percent, e.g. "4.06"; "0.00" for cash/transfer. */
  commission_rate: string;
  commission_amount: string;
  /** Items total before commission. */
  subtotal: string;
  /** Subtotal minus commission. */
  final_sale_price: string;
  items: SaleItem[];
};

/** One ticket line; `price` defaults server-side to the record's current price. */
export type SaleLineInput = {
  record: number | string;
  quantity: number;
  price?: string;
  /** Whose copy is sold; required when several owners have the record in stock. */
  owner?: number;
};

/** POST /sales/create/ body. `commission_rate` only matters for card. */
export type SaleInput = {
  items: SaleLineInput[];
  payment_method: PaymentMethod;
  commission_rate?: string;
};

/** POST /sales/create/ — `warnings` are non-blocking (no owner, email failed). */
export type SaleResult = {
  sale_id: number;
  sale: Sale;
  warnings: string[];
};

/** GET /sales/ and /sales/metrics/ filters: dates are YYYY-MM-DD, inclusive, store time. */
export type SalesFilters = {
  date_from?: string;
  date_to?: string;
  owner?: number | string;
};

export type SalesReport = {
  /** Tickets newest first, each with all its items. */
  results: Sale[];
  /** Over the filtered lines (only the owner's lines when filtering by owner). */
  totals: { subtotal: string; commission: string; net: string };
};

/** Money breakdown shared by every metrics group. */
export type MetricsBucket = {
  count: number;
  units: number;
  gross: string;
  commission: string;
  net: string;
  average_ticket: string;
};

/** "stripe" = online orders; "unknown" = point-of-sale sales without a method. */
export type MetricsPaymentMethod = PaymentMethod | "stripe" | "unknown";

export type SalesMetrics = {
  /** `shipping`: charged on online orders, not part of gross. */
  summary: MetricsBucket & { shipping: string };
  channels: (MetricsBucket & { channel: "pos" | "online" })[];
  payment_methods: (MetricsBucket & { method: MetricsPaymentMethod })[];
  top_records: {
    record: number | null;
    title: string;
    artist: string;
    cover_image_url: string | null;
    units: number;
    gross: string;
  }[];
  /** `owner` null = records without owner. `count` is always 0 here. */
  owners: (MetricsBucket & { owner: Pick<Owner, "id" | "name"> | null })[];
};

/** Money string/number → integer cents, e.g. "19.99" → 1999. */
export const toCents = (value: string | number): number =>
  Math.round(Number(value) * 100);

/**
 * Commission in cents: rate % of the subtotal, rounded half-up to the cent.
 * Integer math (rate in basis points) so the preview matches the backend's
 * Decimal ROUND_HALF_UP exactly.
 */
export const commissionCents = (subtotalCents: number, ratePercent: string | number): number =>
  Math.round((subtotalCents * Math.round(Number(ratePercent) * 100)) / 10000);
