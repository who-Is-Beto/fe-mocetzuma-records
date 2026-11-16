import { API_BASE_URL } from "../config/api";
import type {
  AdminOrderInput,
  AdminPresale,
  AdminPresaleOption,
  AdminPresaleOrder,
  Presale,
  PresaleInput,
  PresaleLineInput,
  PresaleOptionInput,
  PresaleOrder,
  PresaleOrderFilter,
  PresaleTotals,
  ReserveInput
} from "../domain/presales";
import { http } from "../lib/httpClient";

type Config = { baseUrl?: string; getToken?: () => string | null };

const presaleForm = (input: Partial<PresaleInput>, options?: PresaleOptionInput[], optionImages: (File | null)[] = []) => {
  const data = new FormData();
  for (const key of ["title", "artist", "description", "purchase_deadline", "estimated_arrival"] as const) {
    if (input[key] !== undefined) data.append(key, input[key] as string);
  }
  if (input.cover) data.append("cover", input.cover);
  if (options) data.append("options", JSON.stringify(options));
  optionImages.forEach((file, i) => file && data.append(`option_image_${i}`, file));
  return data;
};

/** Repository for /presales/ (public reads, customer orders, admin). */
export function createPresaleService(config: Config = {}) {
  const root = `${(config.baseUrl ?? API_BASE_URL).replace(/\/$/, "")}/presales`;
  const auth = () => ({ token: config.getToken?.() ?? undefined });
  const admin = `${root}/admin`;

  return {
    list: () => http<Presale[]>(`${root}/`),
    get: (slug: string) => http<Presale>(`${root}/${encodeURIComponent(slug)}/`, auth()),
    estimateShipping: (items: PresaleLineInput[], zip: string) =>
      http<{ shipping_estimate: string; courier: string; service: string }>(`${root}/shipping-estimate/`, {
        method: "POST",
        body: { items, zip }
      }),
    reserve: (input: ReserveInput) =>
      http<{ checkout_url: string; code: string }>(`${root}/reserve/`, { method: "POST", body: input, ...auth() }),
    /** No amount settles the whole balance; an amount is an abono (≥ 100, multiple of 50). */
    settle: (code: string, amount?: number) =>
      http<{ checkout_url: string }>(`${root}/orders/${code}/settle/`, {
        method: "POST",
        body: amount ? { amount: String(amount) } : undefined,
        ...auth()
      }),
    complete: (sessionId: string) =>
      http<PresaleOrder>(`${root}/checkout/complete/`, { method: "POST", body: { session_id: sessionId }, ...auth() }),
    mine: () => http<PresaleOrder[]>(`${root}/orders/mine/`, auth()),
    qrUrl: (code: string) => `${root}/orders/${code}/qr.png`,
    subscribe: (email: string, website = "") =>
      http<{ message: string }>(`${root}/subscribe/`, { method: "POST", body: { email, website } }),
    confirm: (token: string) =>
      http<{ subscribed: boolean }>(`${root}/subscribe/confirm/`, { method: "POST", body: { token } }),
    unsubscribe: (token: string) =>
      http<{ subscribed: boolean }>(`${root}/unsubscribe/`, { method: "POST", body: { token } }),
    subscription: () => http<{ subscribed: boolean }>(`${root}/subscription/`, auth()),
    setSubscription: (subscribed: boolean) =>
      http<{ subscribed: boolean }>(`${root}/subscription/`, { method: "PATCH", body: { subscribed }, ...auth() }),

    admin: {
      list: () => http<AdminPresale[]>(`${admin}/`, auth()),
      get: (id: number) => http<AdminPresale>(`${admin}/${id}/`, auth()),
      /** optionImages[i] is the optional photo of options[i]. */
      create: (input: PresaleInput, options: PresaleOptionInput[], optionImages: (File | null)[] = []) =>
        http<AdminPresale>(`${admin}/`, { method: "POST", body: presaleForm(input, options, optionImages), ...auth() }),
      update: (id: number, input: Partial<PresaleInput> & { status?: "draft" | "closed" }) => {
        const body = presaleForm(input);
        if (input.status) body.append("status", input.status);
        return http<AdminPresale>(`${admin}/${id}/`, { method: "PATCH", body, ...auth() });
      },
      remove: (id: number) => http<void>(`${admin}/${id}/`, { method: "DELETE", ...auth() }),
      addOption: (id: number, input: PresaleOptionInput) =>
        http<AdminPresaleOption>(`${admin}/${id}/options/`, { method: "POST", body: input, ...auth() }),
      updateOption: (optionId: number, input: Partial<PresaleOptionInput>) =>
        http<AdminPresaleOption>(`${admin}/options/${optionId}/`, { method: "PATCH", body: input, ...auth() }),
      setOptionImage: (optionId: number, image: File) => {
        const body = new FormData();
        body.append("image", image);
        return http<AdminPresaleOption>(`${admin}/options/${optionId}/`, { method: "PATCH", body, ...auth() });
      },
      removeOption: (optionId: number) =>
        http<void>(`${admin}/options/${optionId}/`, { method: "DELETE", ...auth() }),
      publishPreview: (id: number) =>
        http<{ recipients: number; announced_at: string | null }>(`${admin}/${id}/publish/`, auth()),
      publish: (id: number, announce: boolean) =>
        http<{ status: string; recipients: number }>(`${admin}/${id}/publish/`, {
          method: "POST",
          body: { announce },
          ...auth()
        }),
      /** Several presales at once: they appear together and subscribers get one email. */
      publishMany: (ids: number[], announce: boolean) =>
        http<{ published: number; recipients: number }>(`${admin}/publish/`, {
          method: "POST",
          body: { ids, announce },
          ...auth()
        }),
      /** Pedidos: paid presale orders going by mail (to ship, then shipped). */
      shipments: () => http<AdminPresaleOrder[]>(`${admin}/shipments/`, auth()),
      /** A shipping buyer picks up at the store; paid shipping must be handed back (shippingRefunded). */
      toPickup: (orderId: number, shippingRefunded: boolean) =>
        http<AdminPresaleOrder>(`${admin}/orders/${orderId}/to-pickup/`, {
          method: "POST",
          body: { shipping_refunded: shippingRefunded },
          ...auth()
        }),
      /** copies: how many arrived in this batch (omitted = all the rest). */
      arrivedOption: (optionId: number, copies?: number) =>
        http<AdminPresale>(`${admin}/options/${optionId}/arrived/`, {
          method: "POST",
          body: copies === undefined ? undefined : { copies },
          ...auth()
        }),
      arrivedAll: (id: number) => http<AdminPresale>(`${admin}/${id}/arrived/`, { method: "POST", ...auth() }),
      extend: (id: number, until: string) =>
        http<{ updated: number }>(`${admin}/${id}/extend/`, { method: "POST", body: { until }, ...auth() }),
      orders: (id: number, filter: PresaleOrderFilter = "all") =>
        http<{ totals: PresaleTotals; orders: AdminPresaleOrder[] }>(`${admin}/${id}/orders/`, {
          query: { filter: filter === "all" ? undefined : filter },
          ...auth()
        }),
      createOrder: (input: AdminOrderInput) =>
        http<AdminPresaleOrder>(`${admin}/orders/`, { method: "POST", body: input, ...auth() }),
      byCode: (code: string) =>
        http<AdminPresaleOrder>(`${admin}/orders/code/${encodeURIComponent(code.trim())}/`, auth()),
      order: (orderId: number) => http<AdminPresaleOrder>(`${admin}/orders/${orderId}/`, auth()),
      updateOrder: (
        orderId: number,
        input: Partial<Pick<AdminPresaleOrder, "delivery" | "buyer_name" | "buyer_email" | "buyer_phone">> & {
          deadline_override?: string | null;
          shipping_details?: Record<string, string>;
        }
      ) => http<AdminPresaleOrder>(`${admin}/orders/${orderId}/`, { method: "PATCH", body: input, ...auth() }),
      addPayment: (orderId: number, input: { amount: string; method: "cash" | "card" | "transfer"; note?: string }) =>
        http<AdminPresaleOrder>(`${admin}/orders/${orderId}/payments/`, { method: "POST", body: input, ...auth() }),
      voidPayment: (paymentId: number, reason: string) =>
        http<AdminPresaleOrder>(`${admin}/payments/${paymentId}/void/`, {
          method: "POST",
          body: { reason },
          ...auth()
        }),
      /** itemIds: the lines handed over; omitted = every arrived line. */
      deliver: (orderId: number, itemIds?: number[]) =>
        http<AdminPresaleOrder>(`${admin}/orders/${orderId}/deliver/`, {
          method: "POST",
          body: itemIds ? { item_ids: itemIds } : undefined,
          ...auth()
        }),
      ship: (orderId: number, tracking: string) =>
        http<AdminPresaleOrder>(`${admin}/orders/${orderId}/ship/`, { method: "POST", body: { tracking }, ...auth() }),
      cancel: (orderId: number, reason: string) =>
        http<AdminPresaleOrder>(`${admin}/orders/${orderId}/cancel/`, { method: "POST", body: { reason }, ...auth() }),
      expire: (orderId: number) =>
        http<AdminPresaleOrder>(`${admin}/orders/${orderId}/expire/`, { method: "POST", ...auth() }),
      reopen: (orderId: number) =>
        http<AdminPresaleOrder>(`${admin}/orders/${orderId}/reopen/`, { method: "POST", ...auth() }),
      requote: (orderId: number) =>
        http<AdminPresaleOrder>(`${admin}/orders/${orderId}/shipping-quote/`, { method: "POST", ...auth() })
    }
  };
}

export type PresaleService = ReturnType<typeof createPresaleService>;
