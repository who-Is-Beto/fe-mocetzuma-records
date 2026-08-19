import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { Toast } from "../../components/Toast";
import { createRecordService } from "../../app/services/recordService";
import type { Record as MusicRecord } from "../../app/domain/album";
import { getEffectivePrice } from "../../app/domain/album";
import { useServiceQuery } from "../../app/hooks";
import { HttpError } from "../../app/lib/httpClient";
import { useAuth } from "../../app/providers/AuthProvider";
import { createCartService } from "../../app/services/cartService";
import { usePageTitle } from "../../app/hooks/usePageTitle";

const CART_CODE_KEY = "moctezuma-cart-code";

const getCartCode = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CART_CODE_KEY);
};

const persistCartCode = (code?: string | null) => {
  if (typeof window === "undefined" || !code) return;
  localStorage.setItem(CART_CODE_KEY, code);
};

const currency = (value?: number | string) =>
  typeof value === "string" || typeof value === "number"
    ? Number(value).toLocaleString("es-mx", {
        style: "currency",
        currency: "MXN"
      })
    : "—";

type CarouselProps = { images: string[]; title: string };

function RecordImageCarousel({ images, title }: CarouselProps) {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  const prev = () =>
    setCurrent((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () =>
    setCurrent((i) => (i === images.length - 1 ? 0 : i + 1));

  if (images.length === 1) {
    return (
      <img
        src={images[0]}
        alt={title}
        className="h-full w-full object-contain"
        loading="lazy"
      />
    );
  }

  return (
    <div className="relative h-full w-full bg-navy/5">
      {/* Preload next/prev for smooth navigation */}
      {images.map((src, idx) =>
        idx === current ? null : (
          <link
            key={`preload-${idx}`}
            rel="prefetch"
            as="image"
            href={src}
          />
        )
      )}
      <img
        src={images[current]}
        alt={`${title} — imagen ${current + 1}`}
        className={`h-full w-full object-contain transition-opacity duration-200 ${
          loaded[current] ? "opacity-100" : "opacity-0"
        }`}
        loading="eager"
        onLoad={() => setLoaded((prev) => ({ ...prev, [current]: true }))}
      />
      {!loaded[current] && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy/20 border-t-orange" />
        </div>
      )}
      {/* Nav arrows */}
      <button
        type="button"
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white text-sm backdrop-blur-sm transition hover:bg-black/60"
        aria-label="Imagen anterior"
      >
        &#8249;
      </button>
      <button
        type="button"
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white text-sm backdrop-blur-sm transition hover:bg-black/60"
        aria-label="Siguiente imagen"
      >
        &#8250;
      </button>
      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {images.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrent(idx)}
            className={`h-2 w-2 rounded-full transition ${
              idx === current
                ? "bg-white scale-110"
                : "bg-white/50 hover:bg-white/70"
            }`}
            aria-label={`Imagen ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}


export function RecordDetailPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { token, isAuthenticated, emailVerified } = useAuth();
  const [cartStatus, setCartStatus] = useState<
    "idle" | "adding" | "added" | "error"
  >("idle");
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);

  // Authenticated but unverified: browsing is fine, purchasing is locked.
  // `null` (legacy session before email_verified existed) counts as unverified.
  const requiresVerification = isAuthenticated && emailVerified !== true;
  const verifyHint =
    "Verifica tu correo para poder agregar al carrito. Puedes reenviar el enlace desde tu perfil.";

  const recordService = useMemo(() => createRecordService(), []);

  const cacheKey = useMemo(
    () => (slug ? `record-detail:${slug}` : null),
    [slug]
  );
  const cachedRecord = useMemo<MusicRecord | null>(() => {
    if (!cacheKey || typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MusicRecord;
    } catch {
      return null;
    }
  }, [cacheKey]);

  const fetchRecord = useCallback(async (): Promise<MusicRecord | null> => {
    if (!slug) return null;

    try {
      const record = await recordService.getRecordBySlug(slug);
      if (cacheKey && typeof window !== "undefined") {
        sessionStorage.setItem(cacheKey, JSON.stringify(record));
      }
      return record;
    } catch (err) {
      const httpError = err as HttpError;
      const isNotFound =
        httpError instanceof HttpError && httpError.status === 404;

      if (isNotFound) {
        // Fallback: try searching by slug/title in case direct endpoint 404s
        try {
          const searchResults = await recordService.search({
            query: slug,
            page: 1
          });
          const match =
            searchResults.results?.find((item) => item.slug === slug) ??
            searchResults.results?.[0];

          if (match) {
            if (cacheKey && typeof window !== "undefined") {
              sessionStorage.setItem(cacheKey, JSON.stringify(match));
            }
            return match;
          }
        } catch {
          // ignore and rethrow original 404 below
        }
      }

      throw err;
    }
  }, [cacheKey, recordService, slug]);

  const { data, isLoading, isError, error } = useServiceQuery<MusicRecord | null>(
    [recordService, slug],
    fetchRecord,
    { initialData: cachedRecord ?? undefined, enabled: Boolean(slug) }
  );

  usePageTitle(data?.title ?? null);

  if (!slug) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-cream/80 p-6 text-sm text-navy shadow-panel">
        Registro no encontrado.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (isError || !data) {
    const isNotFound = error instanceof HttpError && error.status === 404;
    return (
      <div className="rounded-2xl border border-navy/10 bg-cream/80 p-6 text-sm text-navy shadow-panel">
        <p className="font-semibold text-denim">
          {isNotFound ? "Disco no encontrado" : "No pudimos cargar este disco."}
        </p>
        <p className="text-navy/70">
          {isNotFound
            ? "Revisa el enlace o regresa al catálogo."
            : "Inténtalo de nuevo en unos segundos."}
        </p>
        <div className="mt-3 flex gap-3">
          <Button
            tone="outline"
            className="px-4 py-2 text-sm"
            onClick={() => navigate(-1)}
          >
            ← Regresar
          </Button>
          <Button
            tone="navy"
            className="px-4 py-2 text-sm"
            onClick={() => navigate("/")}
          >
            Ir al catálogo
          </Button>
        </div>
      </div>
    );
  }

  const { original, effective: effectivePrice, discount: discountPct, hasDiscount } = getEffectivePrice(data);
  const genereLabel =
    typeof data.genere === "string"
      ? data.genere
      : typeof data.genere === "number"
      ? String(data.genere)
      : data.genere?.name ?? "—";

  const handleAddToCart = async () => {
    if (!isAuthenticated || !token) {
      navigate("/login", { state: { from: location } });
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
        // ignore and fallback
      }
      return null;
    };
    try {
      setCartStatus("adding");
      const cartCode = await getOrFetchCartCode();
      const response = await cartService.addItem(
        data.id,
        cartCode ?? undefined
      );
      persistCartCode(response.cart_code);
      setCartStatus("added");
      setToast({ message: "Agregado al carrito", tone: "success" });
      setTimeout(() => setToast(null), 5000);
      setTimeout(() => setCartStatus("idle"), 5000);
    } catch (err) {
      setCartStatus("error");
      const message =
        err instanceof HttpError &&
        (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error?: { message?: string } }).error?.message ??
            "No se pudo agregar al carrito."
          : "No se pudo agregar al carrito.";
      setToast({ message, tone: "error" });
      setTimeout(() => setToast(null), 5000);
      setTimeout(() => setCartStatus("idle"), 5000);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareData: ShareData = {
      title: data.title,
      text: `Mira este disco en Moctezuma Records: ${data.title}`,
      url
    };
    // Native share sheet first (better UX on mobile/desktop), clipboard as fallback.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // The user cancelling the native sheet is not an error.
        if ((err as { name?: string })?.name !== "AbortError") {
          setToast({ message: "No pudimos compartir el disco.", tone: "error" });
          setTimeout(() => setToast(null), 5000);
        }
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast({
        message: "Enlace copiado al portapapeles",
        tone: "success"
      });
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast({ message: "No pudimos copiar el enlace.", tone: "error" });
      setTimeout(() => setToast(null), 5000);
    }
  };

  return (
    <section className="grid gap-4 rounded-[28px] border border-navy/10 bg-cream/80 p-4 shadow-panel backdrop-blur sm:p-5 lg:grid-cols-[1.05fr,0.95fr] lg:gap-5 lg:p-6">
      <div className="space-y-4">
        <div className="relative aspect-square overflow-hidden rounded-[24px] border border-navy/10 bg-gradient-to-br from-denim/10 via-cream to-sand/80 shadow-inner">
          {(() => {
            const images: string[] = data.images?.length
              ? data.images
              : data.cover_image_url
              ? [data.cover_image_url]
              : [];
            if (images.length === 0) {
              return (
                <div className="flex h-full w-full items-center justify-center text-4xl">
                  🎵
                </div>
              );
            }
            return <RecordImageCarousel images={images} title={data.title} />;
          })()}
          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5 sm:left-4 sm:top-4 sm:gap-2">
            <span className="rounded-pill bg-sun px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy shadow-sm sm:px-3 sm:py-1 sm:text-[11px]">
              {data.category?.name ?? "Categoría"}
            </span>
            <span className="rounded-pill border border-navy/10 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-navy/70 sm:px-3 sm:py-1 sm:text-[11px]">
              {data.condition}
            </span>
            {data.featured ? (
              <span className="rounded-pill border border-orange/60 bg-orange px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal shadow-panel sm:px-3 sm:py-1 sm:text-[11px]">
                Destacado
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <Button
            tone="outline"
            className="w-full px-4 py-2.5 text-sm sm:w-auto"
            onClick={() => navigate(-1)}
          >
            ← Regresar
          </Button>
          <Button
            tone="outline"
            className="w-full px-4 py-2.5 text-sm sm:w-auto"
            onClick={() => void handleShare()}
          >
            <svg
              className="mr-1 inline-block"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Compartir
          </Button>
          <Button
            tone="orange"
            className="w-full px-4 py-2.5 text-sm sm:w-auto"
            onClick={handleAddToCart}
            disabled={cartStatus === "adding" || requiresVerification || data.stock <= 0}
            title={requiresVerification ? verifyHint : undefined}
          >
            {data.stock <= 0
              ? "Agotado"
              : requiresVerification
              ? "Verifica tu correo para comprar"
              : cartStatus === "added"
              ? "Agregado"
              : cartStatus === "adding"
              ? "Añadiendo..."
              : "Agregar al carrito"}
          </Button>
        </div>
        {requiresVerification ? (
          <p className="flex flex-wrap items-center gap-2 rounded-xl border border-orange/40 bg-orange/10 px-3 py-2 text-xs text-navy/80">
            <span>✉️ Tu correo aún no está verificado.</span>
            <button
              type="button"
              onClick={() => navigate("/perfil")}
              className="font-semibold text-orange underline underline-offset-2"
            >
              Verificarlo desde tu perfil
            </button>
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-card sm:p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-orange">
            Disco
          </p>
          <h1 className="mt-2 font-display text-2xl text-denim sm:text-3xl">
            {data.title}
          </h1>
          <p className="mt-1 text-sm text-navy/70">
            {typeof data.artist === "string" ? data.artist : data.artist?.name}
          </p>

          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-2 rounded-xl border border-navy/10 bg-cream/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-orange">
                  Precio
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-semibold text-denim">
                    {currency(effectivePrice)}
                  </p>
                  {hasDiscount ? (
                    <>
                    <span className="text-sm text-navy/60 line-through">
                      {currency(original)}
                    </span>
                      <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-bold text-coral">
                        -{discountPct}%
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <span className="rounded-pill border border-navy/10 bg-navy/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-navy/80">
                {data.stock > 0 ? `${data.stock} en stock` : "Agotado"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-navy/10 bg-cream/60 p-4 shadow-inner">
                <p className="text-xs uppercase tracking-[0.14em] text-orange">
                  Lanzamiento
                </p>
                <p className="font-semibold text-denim">
                  {data.release_date ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-navy/10 bg-cream/60 p-4 shadow-inner">
                <p className="text-xs uppercase tracking-[0.14em] text-orange">
                  Contenido
                </p>
                <p className="font-semibold text-denim">
                  {data.items_inside
                    ? `${data.items_inside} ${
                        data.items_inside === 1 ? "pieza" : "piezas"
                      }`
                    : "No especificado"}
                </p>
              </div>
              <div className="rounded-xl border border-navy/10 bg-cream/60 p-4 shadow-inner">
                <p className="text-xs uppercase tracking-[0.14em] text-orange">
                  Género
                </p>
                <p className="font-semibold text-denim">{genereLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-card sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-orange">
            Detalle
          </p>
          <div className="mt-3 grid gap-3 text-sm text-navy">
            <div className="rounded-xl border border-navy/10 bg-cream/60 p-3 shadow-inner sm:p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-orange">
                Categoría
              </p>
              <p className="font-semibold text-denim">
                {data.category?.name ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-navy/10 bg-cream/60 p-3 shadow-inner sm:p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-orange">
                Estado
              </p>
              <p className="font-semibold text-denim">
                {data.condition ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-navy/10 bg-cream/60 p-3 shadow-inner sm:p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-orange">
                Descripción
              </p>
              <p className="text-sm text-navy/80">
                {data.description ?? "Sin descripción"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-navy/10 bg-white/90 p-4 text-sm text-navy shadow-card">
          <p className="font-semibold text-denim">¿Tienes dudas?</p>
          <p className="text-navy/70">
            Escríbenos en Instagram y menciona este nombre: {data.title}.
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

export default RecordDetailPage;
