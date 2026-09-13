import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../app/providers/AuthProvider";
import { useServiceQuery } from "../../app/hooks";
import {
  createCartService,
  type CartResponse,
  type ShippingDetails
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
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, number>>(
    {}
  );
  const [cartItems, setCartItems] = useState<CartResponse["cart_items"]>([]);
  const [isFlushing, setIsFlushing] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | number | null>(
    null
  );
  const [, setCheckoutUrl] = useState<string | null>(null);
  const [deliveryOption, setDeliveryOption] = useState<
    "store" | "home" | "bazar" | null
  >(null);
  const [shippingAddress, setShippingAddress] = useState({
    fullName: "",
    phone: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    zip: "",
    reference: ""
  });
  const [shippingErrors, setShippingErrors] = useState<Record<string, string>>(
    {}
  );
  const shippingFormRef = useRef<HTMLFormElement | null>(null);
  const handleShippingChange = useCallback(
    (field: keyof typeof shippingAddress, value: string) => {
      setShippingAddress((prev) => ({ ...prev, [field]: value }));
      setShippingErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );
  const readShippingDetailsFromForm = useCallback((): ShippingDetails | null => {
    if (!shippingFormRef.current) return null;
    const formData = new FormData(shippingFormRef.current);
    const details: ShippingDetails = {
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      street: String(formData.get("street") ?? ""),
      number: String(formData.get("number") ?? ""),
      neighborhood: String(formData.get("neighborhood") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
      zip: String(formData.get("zip") ?? ""),
      reference: String(formData.get("reference") ?? "")
    };
    setShippingAddress(details);
    return details;
  }, []);
  const isMountedRef = useRef(true);
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

  const showToast = useCallback(
    (message: string, tone: "error" | "success" = "success") => {
      setToast({ message, tone });
      setTimeout(() => setToast(null), 4500);
    },
    []
  );

  const { data, isLoading, isError, error, refetch } = useServiceQuery<
    CartResponse[]
  >([cartService, token], fetchCarts, {
    initialData: cachedCarts ?? undefined,
    enabled: Boolean(token)
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const carts = data ?? [];
  const activeCart = carts[0];
  useEffect(() => {
    isMountedRef.current = true;
    if (!activeCart?.cart_items) {
      setQuantities({});
      setPendingUpdates({});
      setCartItems([]);
      return;
    }
    const nextQuantities: Record<string, number> = {};
    activeCart.cart_items.forEach((item) => {
      nextQuantities[String(item.id)] = item.quantity ?? 0;
    });
    setQuantities(nextQuantities);
    setPendingUpdates({});
    setCartItems(activeCart.cart_items);
  }, [activeCart]);

  const stockByItemId = useMemo(() => {
    const map: Record<string, number> = {};
    cartItems?.forEach((item) => {
      if (typeof item.record?.stock === "number") {
        map[String(item.id)] = item.record.stock;
      }
    });
    return map;
  }, [cartItems]);

  const handleQuantityChange = useCallback(
    (itemId: string | number, nextQuantity: number) => {
      const key = String(itemId);
      const availableStock = stockByItemId[key] ?? null;
      const safeQuantity = Math.max(1, Math.floor(nextQuantity));
      const stockValue =
        typeof availableStock === "number" && !Number.isNaN(availableStock)
          ? availableStock
          : Infinity;

      if (safeQuantity > stockValue) {
        showToast(
          `Solo hay ${
            Number.isFinite(stockValue) ? stockValue : availableStock ?? 0
          } pieza${stockValue === 1 ? "" : "s"} disponibles.`,
          "error"
        );
        return;
      }

      setQuantities((prev) => ({ ...prev, [key]: safeQuantity }));
      setPendingUpdates((prev) => ({ ...prev, [key]: safeQuantity }));
    },
    [showToast, stockByItemId]
  );

  const totalItems =
    cartItems?.reduce((sum, item) => {
      const quantity = quantities[String(item.id)] ?? item.quantity ?? 0;
      return sum + quantity;
    }, 0) ?? 0;
  const totalPrice =
    cartItems?.reduce((sum, item) => {
      const quantity = quantities[String(item.id)] ?? item.quantity ?? 0;
      const baseQuantity =
        item.quantity && item.quantity > 0 ? item.quantity : 1;
      const unitPrice = Number(item.subtotal ?? 0) / baseQuantity;
      return sum + unitPrice * quantity;
    }, 0) ?? Number(activeCart?.total_price ?? 0);
  const hasPendingChanges = Object.keys(pendingUpdates).length > 0;
  const flushPendingUpdates = useCallback(
    async ({
      refetchAfter = true,
      silent = false
    }: { refetchAfter?: boolean; silent?: boolean } = {}) => {
      if (!Object.keys(pendingUpdates).length) return;
      if (isMountedRef.current) {
        setIsFlushing(true);
      }
      const entries = Object.entries(pendingUpdates);
      try {
        await Promise.all(
          entries.map(([itemId, quantity]) =>
            cartService.updateItem(
              Number.isNaN(Number(itemId)) ? itemId : Number(itemId),
              quantity
            )
          )
        );
        if (refetchAfter) {
          await refetch();
        }
        if (!silent && isMountedRef.current) {
          showToast("Cambios guardados");
        }
        if (isMountedRef.current) {
          setPendingUpdates({});
        }
      } catch (err) {
        if (!silent && isMountedRef.current) {
          const message =
            err instanceof HttpError &&
            (err.data as { error?: { message?: string } })?.error?.message
              ? (err.data as { error?: { message?: string } }).error?.message ??
                "No pudimos actualizar la cantidad."
              : err instanceof Error
              ? err.message
              : "No pudimos actualizar la cantidad.";
          showToast(message, "error");
        }
      } finally {
        if (isMountedRef.current) {
          setIsFlushing(false);
        }
      }
    },
    [cartService, pendingUpdates, refetch, showToast]
  );
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      void flushPendingUpdates({ refetchAfter: false, silent: true });
    };
  }, [flushPendingUpdates]);
  const handleRefresh = useCallback(async () => {
    if (hasPendingChanges) {
      await flushPendingUpdates();
    } else {
      await refetch();
    }
  }, [flushPendingUpdates, hasPendingChanges, refetch]);
  const handleCheckout = useCallback(async () => {
    if (!activeCart?.cart_code) {
      showToast("No pudimos iniciar tu checkout.", "error");
      return;
    }
    if (!deliveryOption) {
      showToast("Selecciona un método de entrega para continuar.", "error");
      return;
    }
    let shippingDetails: ShippingDetails | undefined;
    if (deliveryOption === "home") {
      shippingDetails = readShippingDetailsFromForm() ?? undefined;
      if (!shippingDetails) {
        showToast("Completa tu dirección para enviar.", "error");
        return;
      }
      const requiredFields: Array<keyof typeof shippingAddress> = [
        "fullName",
        "phone",
        "street",
        "number",
        "city",
        "state",
        "zip"
      ];
      const nextErrors: Record<string, string> = {};
      requiredFields.forEach((field) => {
        if (!shippingDetails?.[field]?.trim()) {
          nextErrors[field] = "Campo requerido";
        }
      });
      if (Object.keys(nextErrors).length) {
        setShippingErrors(nextErrors);
        showToast("Completa tu dirección para enviar.", "error");
        return;
      }
      setShippingErrors({});
    }
    setIsCheckingOut(true);
    try {
      await flushPendingUpdates();
      const response = await cartService.createCheckoutSession(
        activeCart.cart_code,
        deliveryOption,
        shippingDetails ?? undefined
      );
      const url = response?.checkout_url;
      if (url) {
        setCheckoutUrl(url);
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("No recibimos la liga de pago.");
      }
    } catch (err) {
      const message =
        err instanceof HttpError &&
        (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error?: { message?: string } }).error?.message ??
            "No pudimos iniciar tu checkout."
          : err instanceof Error
          ? err.message
          : "No pudimos iniciar tu checkout.";
      showToast(message, "error");
    } finally {
      setIsCheckingOut(false);
    }
  }, [
    activeCart?.cart_code,
    cartService,
    deliveryOption,
    flushPendingUpdates,
    readShippingDetailsFromForm,
    showToast
  ]);
  const handleRemoveItem = useCallback(
    async (
      itemId: string | number,
      recordId: string | number,
      cartCode?: string
    ) => {
      if (!cartCode) {
        showToast("No pudimos identificar tu carrito.", "error");
        return;
      }
      setDeletingItemId(itemId);
      try {
        await cartService.removeItem(cartCode, recordId);
        setCartItems((prev) =>
          prev.filter((item) => String(item.id) !== String(itemId))
        );
        setQuantities((prev) => {
          const next = { ...prev };
          delete next[String(itemId)];
          return next;
        });
        setPendingUpdates((prev) => {
          const next = { ...prev };
          delete next[String(itemId)];
          return next;
        });
        showToast("Artículo eliminado");
      } catch (err) {
        const message =
          err instanceof HttpError &&
          (err.data as { error?: { message?: string } })?.error?.message
            ? (err.data as { error?: { message?: string } }).error?.message ??
              "No pudimos eliminar el artículo."
            : err instanceof Error
            ? err.message
            : "No pudimos eliminar el artículo.";
        showToast(message, "error");
      } finally {
        setDeletingItemId(null);
      }
    },
    [cartService, flushPendingUpdates, hasPendingChanges, refetch, showToast]
  );
  const handleClearCart = useCallback(async () => {
    if (!activeCart?.cart_code || !cartItems?.length) {
      showToast("Tu carrito ya está vacío.", "error");
      return;
    }
    setIsClearing(true);
    try {
      await flushPendingUpdates({ silent: true });
      await cartService.removeAll(activeCart.cart_code);
      setCartItems([]);
      setQuantities({});
      setPendingUpdates({});
      showToast("Carrito vaciado");
    } catch (err) {
      const message =
        err instanceof HttpError &&
        (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error?: { message?: string } }).error?.message ??
            "No pudimos vaciar el carrito."
          : err instanceof Error
          ? err.message
          : "No pudimos vaciar el carrito.";
      showToast(message, "error");
    } finally {
      setIsClearing(false);
    }
  }, [
    activeCart?.cart_code,
    cartItems?.length,
    cartService,
    flushPendingUpdates,
    showToast
  ]);
  useEffect(() => {
    if (deliveryOption !== "home") {
      setShippingErrors({});
    }
  }, [deliveryOption]);

  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (error instanceof HttpError) {
      const payload = error.data as
        | { error?: { message?: string } }
        | undefined;
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
          {hasPendingChanges ? (
            <span className="rounded-pill bg-sun px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-navy shadow-inner">
              Cambios pendientes
            </span>
          ) : null}
          <Button
            tone="outline"
            className="px-3 py-2 text-sm"
            onClick={() => void handleRefresh()}
            disabled={isFlushing || isCheckingOut || isClearing}
          >
            {isFlushing ? "Guardando..." : "Actualizar"}
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl border border-coral/30 bg-coral/10 p-4 text-sm text-navy shadow-card">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-denim">Hubo un problema</p>
            <Button
              tone="outline"
              className="px-3 py-1 text-xs"
              onClick={() => refetch()}
            >
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
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1fr,0.8fr]">
          <div className="space-y-3 min-w-0">
            {cartItems?.map((item) => {
              const displayQuantity =
                quantities[String(item.id)] ?? item.quantity ?? 0;
              const baseQuantity =
                item.quantity && item.quantity > 0 ? item.quantity : 1;
              const unitPrice = Number(item.subtotal ?? 0) / baseQuantity;
              const displaySubtotal = unitPrice * displayQuantity;
              const isPendingItem =
                pendingUpdates[String(item.id)] !== undefined;
              const availableStock =
                typeof item.record.stock === "number" &&
                !Number.isNaN(item.record.stock)
                  ? item.record.stock
                  : null;
              const isOverStock =
                availableStock !== null && displayQuantity > availableStock;

              return (
                <div
                  key={item.id}
                  className="flex w-full flex-col gap-3 rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-card sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:w-1/2">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-navy/10 bg-cream shadow-inner">
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
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.14em] text-orange">
                        Disco
                      </p>
                      <p className="font-semibold text-denim leading-tight break-words">
                        {item.record.title}
                      </p>
                      <p className="text-xs text-navy/70">
                        {item.record.artist?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase tracking-[0.14em] text-orange">
                          Cantidad
                        </span>
                        <div className="flex items-center gap-2 rounded-pill border border-navy/10 bg-cream px-2 py-1 shadow-inner">
                          <Button
                            tone="outline"
                            pill={false}
                            className="h-8 w-8 px-0 py-0 text-base"
                            disabled={displayQuantity <= 1}
                            onClick={() =>
                              handleQuantityChange(item.id, displayQuantity - 1)
                            }
                            aria-label="Reducir cantidad"
                          >
                            −
                          </Button>
                          <span className="min-w-[72px] text-center text-sm font-semibold text-denim">
                            {displayQuantity}{" "}
                            {displayQuantity === 1 ? "pieza" : "piezas"}
                          </span>
                          <Button
                            tone="outline"
                            pill={false}
                            className="h-8 w-8 px-0 py-0 text-base"
                            disabled={isFlushing}
                            onClick={() =>
                              handleQuantityChange(item.id, displayQuantity + 1)
                            }
                            aria-label="Aumentar cantidad"
                          >
                            +
                          </Button>
                        </div>
                        {isPendingItem ? (
                          <span className="rounded-pill bg-sun px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-navy shadow-inner">
                            Pendiente
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`text-[11px] ${
                            isOverStock
                              ? "text-coral font-semibold"
                              : "text-navy/60"
                          }`}
                        >
                          {isOverStock
                            ? `Agotado: disponibles ${availableStock}`
                            : `Stock disponible: ${item.record.stock ?? "—"}`}
                        </p>
                        {isOverStock ? (
                          <span className="rounded-pill border border-coral/40 bg-coral/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-coral shadow-inner">
                            Agotado
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          tone="outline"
                          className="px-3 py-1 text-xs text-coral"
                          disabled={isFlushing || deletingItemId === item.id}
                          onClick={() =>
                            void handleRemoveItem(
                              item.id,
                              item.record.id,
                              activeCart?.cart_code
                            )
                          }
                        >
                          {deletingItemId === item.id
                            ? "Eliminando..."
                            : "Eliminar"}
                        </Button>
                      </div>
                    </div>
                    <div className="text-right sm:min-w-[120px]">
                      <p className="text-xs uppercase tracking-[0.14em] text-orange">
                        Subtotal
                      </p>
                      <p className="font-semibold text-denim">
                        {currency(displaySubtotal)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {cartItems?.length === 0 ? (
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

          <div className="space-y-3 min-w-0">
            <div className="relative rounded-2xl border border-navy/10 bg-white/90 p-5 shadow-card">
              {isCheckingOut ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
                  <Loader />
                </div>
              ) : null}
              <p className="text-xs uppercase tracking-[0.16em] text-orange">
                Resumen
              </p>
              <div className="mt-3 space-y-2 text-sm text-navy">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span>Ítems</span>
                  <span className="font-semibold text-denim">{totalItems}</span>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span>Código</span>
                  <span className="max-w-[70%] break-all rounded-pill border border-navy/10 bg-cream px-3 py-1 text-xs font-semibold text-denim sm:max-w-none">
                    {activeCart.cart_code}
                  </span>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span>Total</span>
                  <span className="text-lg font-semibold text-denim">
                    {currency(totalPrice)}
                  </span>
                </div>
                <div className="space-y-2 rounded-2xl border border-navy/10 bg-cream/70 p-3 shadow-inner">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-orange">
                    Método de entrega
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      {
                        key: "store",
                        label: "Recoger en tienda",
                        helper: "Sin costo, agenda tu visita."
                      },
                      {
                        key: "home",
                        label: "Envío a domicilio",
                        helper: "Calculamos el envío al pagar."
                      },
                      {
                        key: "bazar",
                        label: "Recoger en bazar",
                        helper: "Coordina en el próximo evento."
                      }
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() =>
                          setDeliveryOption(option.key as "store" | "home" | "bazar")
                        }
                        className={`flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left text-xs font-semibold shadow-card transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
                          deliveryOption === option.key
                            ? "border-orange bg-white text-denim"
                            : "border-navy/10 bg-white/80 text-navy"
                        }`}
                      >
                        <span>{option.label}</span>
                        <span className="text-[11px] font-normal text-navy/70">
                          {option.helper}
                        </span>
                      </button>
                    ))}
                  </div>
                  {!deliveryOption ? (
                    <p className="text-[11px] font-semibold text-coral">
                      Selecciona una opción para continuar.
                    </p>
                  ) : null}
                  {deliveryOption === "home" ? (
                    <form
                      ref={shippingFormRef}
                      id="shipping-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleCheckout();
                      }}
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
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                            Nombre completo
                          </label>
                          <input
                            type="text"
                            name="fullName"
                            value={shippingAddress.fullName}
                            onChange={(e) => handleShippingChange("fullName", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                          />
                          {shippingErrors.fullName ? (
                            <p className="text-[11px] text-coral">{shippingErrors.fullName}</p>
                          ) : null}
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                            Teléfono
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={shippingAddress.phone}
                            onChange={(e) => handleShippingChange("phone", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                          />
                          {shippingErrors.phone ? (
                            <p className="text-[11px] text-coral">{shippingErrors.phone}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[2fr,1fr]">
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                            Calle
                          </label>
                          <input
                            type="text"
                            name="street"
                            value={shippingAddress.street}
                            onChange={(e) => handleShippingChange("street", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                          />
                          {shippingErrors.street ? (
                            <p className="text-[11px] text-coral">{shippingErrors.street}</p>
                          ) : null}
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                            Número
                          </label>
                          <input
                            type="text"
                            name="number"
                            value={shippingAddress.number}
                            onChange={(e) => handleShippingChange("number", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                          />
                          {shippingErrors.number ? (
                            <p className="text-[11px] text-coral">{shippingErrors.number}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                            Colonia / Barrio
                          </label>
                          <input
                            type="text"
                            name="neighborhood"
                            value={shippingAddress.neighborhood}
                            onChange={(e) => handleShippingChange("neighborhood", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                            Ciudad
                          </label>
                          <input
                            type="text"
                            name="city"
                            value={shippingAddress.city}
                            onChange={(e) => handleShippingChange("city", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                          />
                          {shippingErrors.city ? (
                            <p className="text-[11px] text-coral">{shippingErrors.city}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                            Estado
                          </label>
                          <input
                            type="text"
                            name="state"
                            value={shippingAddress.state}
                            onChange={(e) => handleShippingChange("state", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                          />
                          {shippingErrors.state ? (
                            <p className="text-[11px] text-coral">{shippingErrors.state}</p>
                          ) : null}
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                            Código postal
                          </label>
                          <input
                            type="text"
                            name="zip"
                            value={shippingAddress.zip}
                            onChange={(e) => handleShippingChange("zip", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                          />
                          {shippingErrors.zip ? (
                            <p className="text-[11px] text-coral">{shippingErrors.zip}</p>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/80">
                          Referencias (opcional)
                        </label>
                        <textarea
                          name="reference"
                          value={shippingAddress.reference}
                          onChange={(e) => handleShippingChange("reference", e.target.value)}
                          className="mt-1 w-full rounded-xl border border-navy/10 bg-white/80 px-3 py-2 text-sm text-navy shadow-inner focus:outline-none focus:ring-2 focus:ring-orange"
                          rows={3}
                        />
                      </div>
                    </form>
                  ) : null}
                </div>
                <p className="text-[11px] text-navy/60">
                  Actualizado:{" "}
                  {new Date(activeCart.updated_at).toLocaleString()}
                </p>
              </div>
              <Button
                tone="orange"
                className="mt-3 w-full px-4 py-2 text-sm"
                type={deliveryOption === "home" ? "submit" : "button"}
                form={deliveryOption === "home" ? "shipping-form" : undefined}
                disabled={
                  isFlushing ||
                  isCheckingOut ||
                  isClearing ||
                  !cartItems?.length ||
                  !deliveryOption
                }
                onClick={
                  deliveryOption === "home"
                    ? undefined
                    : () => void handleCheckout()
                }
              >
                {isCheckingOut ? "Redirigiendo..." : "Ir a checkout"}
              </Button>
              <Button
                tone="outline"
                className="mt-2 w-full px-4 py-2 text-sm text-coral"
                disabled={
                  isFlushing ||
                  isCheckingOut ||
                  isClearing ||
                  !cartItems?.length
                }
                onClick={() => void handleClearCart()}
              >
                {isClearing ? "Vaciando..." : "Vaciar carrito"}
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
      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}
    </section>
  );
}

export default CartPage;
