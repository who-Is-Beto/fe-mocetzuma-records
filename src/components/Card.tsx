import type { JSX } from "react";
import { Link } from "react-router-dom";
import type { Record } from "../app/domain/album";
import { Button } from "./Button";
import { useAuth } from "../app/providers/AuthProvider";
import { useState } from "react";
import { createCartService } from "../app/services/cartService";
import { HttpError } from "../app/lib/httpClient";
import { Toast } from "./Toast";

const CART_CODE_KEY = "moctezuma-cart-code";

const getCartCode = () => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(CART_CODE_KEY);
};

const persistCartCode = (code?: string | null) => {
  if (typeof window === "undefined" || !code) return;
  sessionStorage.setItem(CART_CODE_KEY, code);
};

type CardProps = {
  record: Record;
};

const currency = (value?: number | string) =>
  typeof value === "string" || typeof value === "number"
    ? Number(value).toLocaleString("es-mx", {
        style: "currency",
        currency: "MXN"
      })
    : "—";

const getArtistName = (artist?: string | { name?: string } | null) => {
  if (!artist) return "Unknown artist";
  return typeof artist === "string" ? artist : artist.name ?? "Unknown artist";
};

export function Card({ record }: CardProps): JSX.Element {
  const { token, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");
  const [toast, setToast] = useState<{ message: string; tone: "error" | "success" } | null>(null);

  const showToast = (message: string, tone: "error" | "success" = "error") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 5000);
  };

  const handleAdd = async () => {
    if (!isAuthenticated || !token) {
      window.location.href = "/login";
      return;
    }

    const cartService = createCartService({ getToken: () => token });
    const getOrFetchCartCode = async () => {
      const cached = getCartCode();
      if (cached) return cached;
      try {
        const carts = await cartService.getCarts();
        const code = carts[0]?.cart_code;
        if (code) {
          persistCartCode(code);
          return code;
        }
      } catch {
        // ignore and fallback to undefined
      }
      return null;
    };

    try {
      setStatus("adding");
      const cartCode = await getOrFetchCartCode();
      const response = await cartService.addItem(record.id, cartCode ?? undefined);
      persistCartCode(response.cart_code);
      setStatus("added");
      showToast("Agregado al carrito", "success");
      setTimeout(() => setStatus("idle"), 1400);
    } catch (err) {
      setStatus("error");
      const message =
        err instanceof HttpError && (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error?: { message?: string } }).error?.message ?? "No se pudo agregar al carrito."
          : "No se pudo agregar al carrito.";
      showToast(message, "error");
      setTimeout(() => setStatus("idle"), 1600);
    }
  };

  return (
    <Link
      to={`/records/${record.slug ?? record.id}`}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-[22px] border border-navy/10 bg-cream/85 p-4 shadow-panel backdrop-blur transition hover:-translate-y-0.5 hover:shadow-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange"
    >
      <article className="flex flex-col gap-3">
        <div className="aspect-square overflow-hidden rounded-[18px] border border-navy/10 bg-gradient-to-br from-denim/10 via-cream to-sand/80 shadow-inner">
          {record.cover_image_url ? (
            <img
              src={record.cover_image_url}
              alt={record.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">
              🎵
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <span className="rounded-pill bg-sun px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy shadow-sm">
                {record.category && record.category.name}
              </span>
              <span className="rounded-pill border border-navy/10 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/70">
                {record.condition}
              </span>
            </div>
            <span className="rounded-pill border border-navy/10 bg-navy/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/70">
              {record.stock > 0
                ? record.stock === 1
                  ? "1 en stock"
                  : `${record.stock} en stock`
                : "Agotado"}
            </span>
          </div>
          <h2 className="line-clamp-2 font-display text-xl text-denim">
            {record.title}
          </h2>
          <p className="text-sm text-navy/70">{getArtistName(record.artist)}</p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="rounded-pill bg-white/90 px-3 py-1 text-sm font-semibold text-navy shadow-sm">
            {currency(record.price)}MXN
          </span>
          <Button
            tone="orange"
            className="px-3 py-1 text-xs"
            disabled={status === "adding"}
            onClick={(event) => {
              event.preventDefault();
              void handleAdd();
            }}
          >
            {status === "added" ? "Agregado" : status === "adding" ? "Añadiendo..." : "Añadir al carrito"}
          </Button>
        </div>
      </article>

      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
    </Link>
  );
}

export default Card;
