import { useMemo, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { useAuth } from "../../app/providers/AuthProvider";
import { useServiceQuery } from "../../app/hooks";
import {
  createCartService,
  type CartResponse
} from "../../app/services/cartService";
import { HttpError } from "../../app/lib/httpClient";

const CART_CACHE_KEY = "moctezuma-cart-cache";

const currency = (value?: number | string) =>
  typeof value === "string" || typeof value === "number"
    ? Number(value).toLocaleString("es-mx", {
        style: "currency",
        currency: "MXN"
      })
    : "—";

const readCachedCarts = (): CartResponse[] | null => {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CART_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CartResponse[];
  } catch {
    return null;
  }
};

const persistCarts = (carts: CartResponse[]) => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CART_CACHE_KEY, JSON.stringify(carts));
};

export function CartPage() {
  const { token, isAuthenticated } = useAuth();
  const cachedCarts = useMemo(() => readCachedCarts(), []);

  const cartService = useMemo(
    () =>
      createCartService({
        getToken: () => token ?? null
      }),
    [token]
  );

  const fetchCarts = useCallback(async () => {
    const carts = await cartService.getCarts();
    persistCarts(carts);
    return carts;
  }, [cartService]);

  const { data, isLoading, isError, error, refetch } = useServiceQuery<CartResponse[]>(
    [cartService, token],
    fetchCarts,
    {
      initialData: cachedCarts ?? undefined,
      enabled: Boolean(token)
    }
  );

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const carts = data ?? [];
  const activeCart = carts[0];
  const totalItems =
    activeCart?.cart_items?.reduce(
      (sum, item) => sum + (item.quantity ?? 0),
      0
    ) ?? 0;
  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (error instanceof HttpError) {
      const payload = error.data as { error?: { message?: string } } | undefined;
      return payload?.error?.message ?? error.message;
    }
    if (error instanceof Error) return error.message;
    return "No pudimos cargar tu carrito.";
  }, [error]);

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-5 shadow-panel backdrop-blur md:space-y-6 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-orange">
            Carrito
          </p>
          <h1 className="font-display text-3xl text-denim">Tus selecciones</h1>
          <p className="text-sm text-navy/70">
            Resumen de tus discos guardados. Refresca para sincronizar con el
            servidor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            tone="outline"
            className="px-3 py-2 text-sm"
            onClick={() => refetch()}
          >
            Actualizar
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl border border-coral/30 bg-coral/10 p-4 text-sm text-navy shadow-card">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-denim">Hubo un problema</p>
            <Button tone="outline" className="px-3 py-1 text-xs" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
          <p className="mt-1 text-navy/80">{errorMessage}</p>
        </div>
      ) : null}

      {isError && !activeCart ? (
        <div className="rounded-2xl border border-navy/10 bg-white/80 p-5 text-sm text-navy shadow-card">
          <p className="font-semibold text-denim">
            No pudimos cargar tu carrito.
          </p>
          <p className="text-navy/70">Intenta actualizar o vuelve más tarde.</p>
        </div>
      ) : null}

      {activeCart ? (
        <div className="grid gap-4 lg:grid-cols-[1fr,0.8fr]">
          <div className="space-y-3">
            {activeCart.cart_items?.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-card sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3 sm:w-1/2">
                  <div className="h-16 w-16 overflow-hidden rounded-xl border border-navy/10 bg-cream shadow-inner">
                    {item.record.cover_image_url ? (
                      <img
                        src={item.record.cover_image_url}
                        alt={item.record.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl">
                        🎵
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-orange">
                      Disco
                    </p>
                    <p className="font-semibold text-denim leading-tight">
                      {item.record.title}
                    </p>
                    <p className="text-xs text-navy/70">
                      {item.record.artist?.name}
                    </p>
                  </div>
                </div>
                <div className="flex flex-1 items-center justify-between gap-3">
                  <div className="rounded-pill border border-navy/10 bg-cream px-3 py-1 text-xs font-semibold text-navy shadow-inner">
                    {item.quantity} {item.quantity === 1 ? "pieza" : "piezas"}
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.14em] text-orange">
                      Subtotal
                    </p>
                    <p className="font-semibold text-denim">
                      {currency(item.subtotal)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {activeCart.cart_items?.length === 0 ? (
              <div className="rounded-2xl border border-navy/10 bg-white/80 p-5 text-sm text-navy shadow-card">
                <p className="font-semibold text-denim">Carrito vacío</p>
                <p className="text-navy/70">
                  Añade discos desde el catálogo para verlos aquí.
                </p>
                <Button
                  tone="orange"
                  className="mt-3 px-4 py-2 text-sm"
                  onClick={() => (window.location.href = "/")}
                >
                  Ir al catálogo
                </Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-navy/10 bg-white/90 p-5 shadow-card">
              <p className="text-xs uppercase tracking-[0.16em] text-orange">
                Resumen
              </p>
              <div className="mt-3 space-y-2 text-sm text-navy">
                <div className="flex items-center justify-between">
                  <span>Ítems</span>
                  <span className="font-semibold text-denim">{totalItems}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Código</span>
                  <span className="rounded-pill border border-navy/10 bg-cream px-3 py-1 text-xs font-semibold text-denim">
                    {activeCart.cart_code}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span className="text-lg font-semibold text-denim">
                    {currency(activeCart.total_price)}
                  </span>
                </div>
                <p className="text-[11px] text-navy/60">
                  Actualizado:{" "}
                  {new Date(activeCart.updated_at).toLocaleString()}
                </p>
              </div>
              <Button
                tone="orange"
                className="mt-3 w-full px-4 py-2 text-sm"
                disabled
              >
                Checkout no disponible
              </Button>
            </div>

            <div className="rounded-2xl border border-navy/10 bg-white/80 p-4 text-sm text-navy shadow-card">
              <p className="font-semibold text-denim">¿Necesitas ayuda?</p>
              <p className="text-navy/70">
                Envíanos tu código de carrito para darle seguimiento.
              </p>
              <Link
                to="https://www.instagram.com/moctezuma_records/"
                target="_blank"
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-orange underline"
              >
                Abrir Instagram
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default CartPage;
