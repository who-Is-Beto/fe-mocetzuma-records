/**
 * Cart code persistence. The backend carts are keyed by a `cart_code` shared
 * across the customer's browser; the frontend stores it so add/cart reads keep
 * working between visits. Previously copy-pasted in Card.tsx, CartPage.tsx and
 * RecordDetailPage.tsx — this is the single source of truth.
 */

const CART_CODE_KEY = "moctezuma-cart-code";

export function getCartCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CART_CODE_KEY);
}

export function persistCartCode(code?: string | null): void {
  if (typeof window === "undefined" || !code) return;
  window.localStorage.setItem(CART_CODE_KEY, code);
}

/** Drop the stored cart code (e.g. on logout so the next user never inherits it). */
export function clearCartCode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_CODE_KEY);
}