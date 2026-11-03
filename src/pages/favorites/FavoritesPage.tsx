import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { CardGridSkeleton, Skeleton } from "../../components/Skeleton";
import { StatusPanel } from "../../components/StatusPanel";
import { Button } from "../../components/Button";
import { primaryCta, secondaryCta } from "../../components/cta";
import { useAuth } from "../../app/providers/AuthProvider";
import { useWishlist } from "../../app/providers/WishlistProvider";
import { useServiceQuery } from "../../app/hooks";
import { useSeo } from "../../app/hooks/useSeo";
import { createWishlistService } from "../../app/services/wishlistService";
import type { Wishlist } from "../../app/domain/wishlist";

type Filter = "all" | "available" | "sold_out";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "available", label: "Disponibles" },
  { key: "sold_out", label: "Agotados" }
];

/**
 * /favoritos: the records the user saved, newest first, as catalog cards
 * (add to cart right there). Un-hearting a card here dims it instead of
 * removing it, so a slip is undone by tapping the heart again; the list
 * refreshes on the next visit.
 */
export function FavoritesPage() {
  useSeo({ title: "Favoritos", noindex: true });
  const { token, isAuthenticated } = useAuth();
  const { isSaved, count } = useWishlist();
  const [filter, setFilter] = useState<Filter>("all");

  const service = useMemo(() => createWishlistService({ getToken: () => token ?? null }), [token]);
  const fetchWishlist = useCallback(() => service.get(), [service]);
  const { data, isLoading, isError, refetch } = useServiceQuery<Wishlist>([service], fetchWishlist, {
    enabled: isAuthenticated
  });

  if (!isAuthenticated) {
    return (
      <StatusPanel
        icon="♡"
        eyebrow="Favoritos"
        title="Guarda los discos que te laten"
        text="Toca el corazón en cualquier disco para guardarlo aquí y volver a él cuando quieras. Solo necesitas una cuenta."
        actions={
          <>
            <Link to="/login" state={{ from: { pathname: "/favoritos" } }} className={primaryCta}>
              Iniciar sesión
            </Link>
            <Link to="/register" className={secondaryCta}>Crear cuenta</Link>
          </>
        }
      />
    );
  }

  if (isLoading && !data) {
    return (
      <section className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <CardGridSkeleton count={3} label="Cargando tus favoritos…" />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <StatusPanel
        icon="🔌"
        title="No pudimos cargar tus favoritos"
        text="Intenta de nuevo en unos segundos."
        actions={
          <Button tone="navy" className="min-h-[52px] px-7" onClick={() => void refetch().catch(() => {})}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <StatusPanel
        icon="♡"
        eyebrow="Favoritos"
        title="Aún no guardas ningún disco"
        text="Toca el corazón de cualquier disco del catálogo y aparecerá aquí."
        actions={
          <Link to="/catalogo" className={primaryCta}>
            Explorar el catálogo
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        }
      />
    );
  }

  const available = data.items.filter((item) => item.record.stock > 0).length;
  const soldOut = data.items.length - available;
  const counts: Record<Filter, number> = { all: data.items.length, available, sold_out: soldOut };
  const shown = data.items.filter((item) =>
    filter === "available" ? item.record.stock > 0 : filter === "sold_out" ? item.record.stock <= 0 : true
  );

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">Favoritos</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-denim sm:text-4xl">Tus favoritos</h1>
          <p className="mt-1.5 text-sm text-navy/75" aria-live="polite">
            {count} {count === 1 ? "disco guardado" : "discos guardados"}
            {available > 0 ? ` · ${available} ${available === 1 ? "disponible" : "disponibles"}` : ""}
          </p>
        </div>

        {/* Filters only matter when the list mixes available and sold-out records */}
        {available > 0 && soldOut > 0 ? (
          <div role="group" aria-label="Filtrar favoritos" className="flex w-full gap-1 rounded-pill border border-navy/10 bg-cream p-1 shadow-sm sm:w-auto">
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={filter === option.key}
                onClick={() => setFilter(option.key)}
                className={`min-h-[40px] flex-1 whitespace-nowrap rounded-pill px-3 text-xs font-semibold transition duration-300 sm:flex-none sm:px-4 ${
                  filter === option.key ? "bg-navy text-cream shadow-card" : "text-navy hover:bg-navy/5"
                }`}
              >
                {option.label} <span className={filter === option.key ? "text-cream/70" : "text-navy/60"}>{counts[option.key]}</span>
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((item, index) => {
          const stillSaved = isSaved(item.record.id);
          return (
            <li
              key={item.id}
              style={{ "--i": Math.min(index, 8) } as CSSProperties}
              className={`reveal relative [&_img]:transition [&_img]:duration-500 ${stillSaved ? "" : "[&_img]:opacity-50 [&_img]:grayscale"}`}
            >
              <Card record={item.record} priority={index < 3} />
              {!stillSaved ? (
                <p role="status" className="pointer-events-none absolute inset-x-4 top-4 z-10 mr-14 rounded-pill bg-navy/90 px-3 py-1.5 text-center text-[11px] font-semibold text-cream shadow-card">
                  Quitado · toca ♡ para regresarlo
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {shown.length === 0 ? (
        <p className="text-center text-sm text-navy/75">No hay discos en este filtro.</p>
      ) : null}
    </section>
  );
}

export default FavoritesPage;
