/**
 * Preventas: upcoming records reserved with a deposit (apartado) or paid in
 * full. Mirrors apiApp/serilizers/presales.py. Money arrives as decimal strings.
 */

export type PresaleOption = {
  id: number;
  name: string;
  image: string | null;
  format: string;
  price: string;
  min_deposit: string;
  full_payment_discount: string;
  copies: number;
  copies_left: number;
  arrived: boolean;
  is_active: boolean;
};

export type Presale = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  description: string;
  cover: string | null;
  purchase_deadline: string;
  estimated_arrival: string;
  status: "draft" | "published" | "closed";
  /** Published, deadline not passed and some option has copies left. */
  is_open: boolean;
  price_from: string | null;
  max_discount: string;
  options: PresaleOption[];
};

export type PresaleOrderStatus =
  | "pending_payment"
  | "apartado"
  | "pagado"
  | "listo"
  | "enviado"
  | "entregado"
  | "vencido"
  | "cancelado";

export type PresaleDelivery = "pickup" | "shipping";

export type PresalePaymentMethod = "stripe" | "cash" | "card" | "transfer";

export type PresalePayment = {
  id: number;
  amount: string;
  method: PresalePaymentMethod;
  method_label: string;
  created_at: string;
  voided: boolean;
};

/** What a customer sees about their own presale order (Mis órdenes). */
export type PresaleOrder = {
  code: string;
  status: PresaleOrderStatus;
  status_label: string;
  presale: { slug: string; title: string; artist: string; cover: string | null; estimated_arrival: string };
  option: { id: number; name: string };
  delivery: PresaleDelivery;
  delivery_label: string;
  item_price: string;
  discount_applied: string;
  shipping_estimate: string | null;
  shipping_cost: string | null;
  /** Shipping order whose shipping isn't quoted yet (paid when the record arrives). */
  shipping_pending: boolean;
  total: string;
  paid: string;
  balance: string;
  deadline: string;
  days_left: number;
  arrived: boolean;
  payments: PresalePayment[];
  shipping_link: string;
  reserved_at: string;
  delivered_at: string | null;
};

export type AdminPresalePayment = PresalePayment & {
  note: string;
  registered_by: string | null;
  void_reason: string;
  voided_by: string | null;
};

export type PresaleOrderEvent = { kind: string; note: string; actor: string | null; created_at: string };

export type AdminPresaleOrder = Omit<PresaleOrder, "payments"> & {
  id: number;
  presale_id: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  has_account: boolean;
  source: "online" | "instagram" | "store" | "other";
  source_label: string;
  shipping_details: Record<string, string>;
  shipping_courier: string;
  deadline_override: string | null;
  is_expirable: boolean;
  oversold: boolean;
  delivered_by: string | null;
  payments: AdminPresalePayment[];
  events: PresaleOrderEvent[];
};

export type PresaleTotals = {
  copies: number;
  reserved: number;
  paid_full: number;
  expired: number;
  collected: string;
  owed: string;
};

export type AdminPresaleOption = Omit<PresaleOption, "image" | "format"> & {
  image_url: string | null;
  category: number | null;
  weight_grams: number | null;
  cost_price: string;
  owner: number | null;
  position: number;
  arrived_at: string | null;
  taken: number;
  has_orders: boolean;
};

export type AdminPresale = Omit<Presale, "cover" | "options" | "is_open" | "price_from" | "max_discount"> & {
  cover_url: string | null;
  announced_at: string | null;
  created_at: string;
  options: AdminPresaleOption[];
  stats: PresaleTotals;
};

export type PresaleOrderFilter = "all" | "owes" | "ready" | "expiring" | "expired";

export type ShippingAddress = {
  fullName: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
};

export type ReserveInput = {
  option_id: number;
  amount: string;
  delivery: PresaleDelivery;
  shipping_details?: ShippingAddress;
  accept_terms: true;
};

export type PresaleOptionInput = {
  name: string;
  price: string;
  min_deposit: string;
  full_payment_discount?: string;
  cost_price?: string;
  owner?: number | null;
  category?: number | null;
  weight_grams?: number | null;
  copies: number;
  is_active?: boolean;
};

export type PresaleInput = {
  title: string;
  artist: string;
  description: string;
  purchase_deadline: string;
  estimated_arrival: string;
  /** New cover to upload; omit on update to keep the current one. */
  cover?: File | null;
};

export type AdminOrderInput = {
  option_id: number;
  buyer_name: string;
  buyer_email?: string;
  buyer_phone?: string;
  source: "instagram" | "store" | "other";
  delivery: PresaleDelivery;
  shipping_details?: Partial<ShippingAddress>;
  amount: string;
  method: Exclude<PresalePaymentMethod, "stripe">;
  note?: string;
  terms_accepted: true;
};

/** Customer-facing progress of a presale order (Mis órdenes). */
export const PRESALE_STEPS = ["Apartado", "Pagado", "Esperando que llegue a tienda", "Listo"] as const;
