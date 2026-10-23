import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { Toast } from "../../components/Toast";
import { createRecordService } from "../../app/services/recordService";
import type { Record as MusicRecord, RecordCopy } from "../../app/domain/album";
import { conditionInfo, getEffectivePrice } from "../../app/domain/album";
import { useServiceQuery } from "../../app/hooks";
import { HttpError } from "../../app/lib/httpClient";
import { useAuth } from "../../app/providers/AuthProvider";
import { createCartService } from "../../app/services/cartService";
import { useSeo } from "../../app/hooks/useSeo";
import { Img } from "../../components/Img";
import { currency } from "../../app/lib/format";
import { getCartCode, persistCartCode } from "../../app/lib/cartStorage";
import { ConditionPicker } from "./ConditionPicker";
import { RecordDescription } from "./RecordDescription";

type CarouselProps = { images: string[]; title: string };

/* Mobile: full width; desktop: the ~600px left column of the detail grid. */
const DETAIL_IMAGE_SIZES = "(min-width: 1024px) 600px, 100vw";

function RecordImageCarousel({ images, title }: CarouselProps) {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  const prev = () =>
    setCurrent((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () =>
    setCurrent((i) => (i === images.length - 1 ? 0 : i + 1));

  // The cover is the page's LCP element: load it eagerly, at high priority.
  if (images.length === 1) {
    return (
      <Img
        src={images[0]}
        alt={title}
        width={640}
        sizes={DETAIL_IMAGE_SIZES}
        priority
        className="h-full w-full object-contain"
      />
    );
  }

  const neighbour = images[(current + 1) % images.length];

  return (
    <div className="relative h-full w-full bg-navy/5">
      <Img
        key={images[current]}
        src={images[current]}
        alt={`${title} — imagen ${current + 1}`}
        width={640}
        sizes={DETAIL_IMAGE_SIZES}
        priority={current === 0}
        placeholder={false}
        className={`h-full w-full object-contain transition-opacity duration-200 ${
          loaded[current] ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setLoaded((prev) => ({ ...prev, [current]: true }))}
      />
      {/* Warm only the next image (same srcset, so the browser reuses it),
          instead of prefetching every full-size original up front. */}
      <Img
        key={`next-${neighbour}`}
        src={neighbour}
        alt=""
        aria-hidden="true"
        width={640}
        sizes={DETAIL_IMAGE_SIZES}
        placeholder={false}
        className="pointer-events-none absolute h-px w-px opacity-0"
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
  // ?copia=<id>: the condition picked among the record's copies (shareable link).
  const [searchParams, setSearchParams] = useSearchParams();
  const copyParam = searchParams.get("copia");
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

  // Public endpoint, but the token lets the maintenance middleware tell an
  // admin (full access) from a customer (503 while the window is open).
  const recordService = useMemo(
    () => createRecordService({ getToken: () => token ?? null }),
    [token]
  );

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

  const { data: fetched, isLoading, isError, error } = useServiceQuery<MusicRecord | null>(
    [recordService, slug],
    fetchRecord,
    { initialData: cachedRecord ?? undefined, enabled: Boolean(slug) }
  );

  /* ── Copies in other conditions: the picked one drives price, stock, photos and the cart ── */
  const copies = useMemo(() => fetched?.copies ?? [], [fetched]);
  const selectedCopy: RecordCopy | null = useMemo(() => {
    if (copies.length < 2 || !fetched) return null;
    return (
      copies.find((c) => String(c.id) === copyParam) ??
      copies.find((c) => String(c.id) === String(fetched.id) && c.stock > 0) ??
      copies.find((c) => c.stock > 0) ??
      copies.find((c) => String(c.id) === String(fetched.id)) ??
      copies[0]
    );
  }, [copies, copyParam, fetched]);
  const data: MusicRecord | null | undefined =
    fetched && selectedCopy
      ? {
          ...fetched,
          id: String(selectedCopy.id),
          condition: selectedCopy.condition,
          price: selectedCopy.price,
          sell_price: selectedCopy.sell_price,
          discount_porcentage: selectedCopy.discount_porcentage,
          stock: selectedCopy.stock,
          cover_image_url: selectedCopy.cover_image_url || fetched.cover_image_url,
          images: selectedCopy.images?.length ? selectedCopy.images : fetched.images
        }
      : fetched;
  const selectCopy = (copy: RecordCopy) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("copia", String(copy.id));
        return next;
      },
      { replace: true }
    );

  // Dynamic SEO: the record title + a short pitch once data arrives.
  useSeo({
    title: data?.title ?? null,
    description: data
      ? `${data.title} de ${data.artist.name} — vinilo ${
          copies.length > 1
            ? `en ${copies.length} condiciones`
            : data.condition
            ? `(${data.condition})`
            : ""
        } disponible en Moctezuma Records. Compra segura con envíos a todo México.`
      : undefined
  });

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
            onClick={() => navigate("/catalogo")}
          >
            Ir al catálogo
          </Button>
        </div>
      </div>
    );
  }

  const { original, effective: effectivePrice, discount: discountPct, hasDiscount } = getEffectivePrice(data);
  const condition = conditionInfo(data.condition);

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
            // keyed by copy: a different condition starts on its own first photo
            return <RecordImageCarousel key={data.id} images={images} title={data.title} />;
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
              : selectedCopy
              ? `Agregar al carrito · ${data.condition}`
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
            {typeof data.artist === "object" && data.artist?.slug ? (
              // Artist page = the catalog filtered by artist (same endpoint,
              // server-side filter + pagination); sold-out records included.
              <Link
                to={`/catalogo?artist=${encodeURIComponent(data.artist.slug)}&available=false`}
                className="inline-flex min-h-[44px] items-center font-semibold text-denim underline decoration-orange/50 underline-offset-4 hover:text-orange"
              >
                {data.artist.name}
                <span className="sr-only"> — ver todos sus discos</span>
              </Link>
            ) : typeof data.artist === "string" ? (
              data.artist
            ) : (
              data.artist?.name
            )}
          </p>

          {/* Genres: compact pills, each one opens the catalog filtered by it */}
          {data.generes?.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={data.generes.length > 1 ? "Géneros" : "Género"}>
              {data.generes.map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/catalogo?genere=${encodeURIComponent(g.slug)}`}
                    className="inline-flex min-h-[28px] items-center rounded-pill border border-denim/15 bg-denim/5 px-3 text-[11px] font-semibold tracking-wide text-denim transition hover:border-orange hover:bg-orange/10 hover:text-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
                  >
                    {g.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 space-y-3">
            {selectedCopy && (
              <ConditionPicker copies={copies} selectedId={selectedCopy.id} onSelect={selectCopy} />
            )}
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
              <span className="self-start rounded-pill border border-navy/10 bg-navy/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-navy/80 sm:self-auto">
                {data.stock > 0
                  ? `${data.stock} en stock${selectedCopy ? ` · ${data.condition}` : ""}`
                  : "Agotado"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-card sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-orange">
            Detalle
          </p>
          <div className="mt-3 grid gap-3 text-sm text-navy">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-navy/10 bg-cream/60 p-3 shadow-inner sm:p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-orange">
                  Formato
                </p>
                <p className="font-semibold text-denim">
                  {data.category?.name ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-navy/10 bg-cream/60 p-3 shadow-inner sm:p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-orange">
                  Estado
                </p>
                <p className="font-semibold text-denim" title={condition?.hint}>
                  {data.condition ?? "—"}
                  {condition && (
                    <span className="ml-1.5 text-xs font-normal text-navy/60">{condition.label}</span>
                  )}
                </p>
              </div>
            </div>
            <RecordDescription description={data.description} />
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
