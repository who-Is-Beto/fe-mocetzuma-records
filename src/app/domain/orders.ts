/**
 * Order domain types and shared vocabulary.
 *
 * Single source of truth shared by the customer "Mis órdenes" page, the admin
 * order manager and the services layer — pages must never import types from
 * each other.
 *
 * Status values mirror `Order.status_choices` in apiApp/models/orders.py
 * ("canceled", one L).
 */

import type { PickupBazar } from "./bazares";

export type OrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "canceled";

export type OrderItem = {
  id: number | string;
  record: {
    id: number | string;
    title: string;
    slug?: string;
    cover_image_url?: string | null;
    artist?: { name?: string } | null;
    price?: string | number;
  } | null;
  quantity: number;
  price: string | number;
};

/** Order as returned by OrderSerializer (customer and admin endpoints). */
export type Order = {
  id: number | string;
  stripe_checkout_session_id: string;
  amount: string | number;
  currency: string;
  user_email: string;
  shipped_to: string;
  shipping_details?: Record<string, string> | null;
  shipping_cost?: string | number | null;
  shipping_courier: string;
  shipping_service: string;
  shipping_link: string;
  pickup_bazar?: PickupBazar | null;
  status: OrderStatus;
  created_at: string;
  updated_at?: string;
  order_items?: OrderItem[];
};

/** Options for the admin status <select> (pedido, masculine inflection). */
export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregado" },
  { value: "canceled", label: "Cancelado" }
];

/** Customer-facing status label (orden, feminine inflection). */
export const statusLabel: Record<OrderStatus, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  shipped: "Enviada",
  delivered: "Entregada",
  canceled: "Cancelada"
};

/** Delivery-method label shared by customer and admin views. */
export const DELIVERY_LABELS: Record<string, string> = {
  store: "Recoger en tienda",
  home: "Envío a domicilio",
  bazar: "Recoger en bazar"
};