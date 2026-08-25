import { Button } from "../../components/Button";
import { useSeo } from "../../app/hooks";
import { useUpcomingBazares } from "../../app/hooks/useUpcomingBazares";
import { BazarCard } from "./BazarCard";

const INSTAGRAM_URL = "https://www.instagram.com/bemoctezuma_records/";

const SKELETON_KEYS = [0, 1, 2];

/**
 * Public /bazares page: upcoming flea-market events where the store sets up
 * a stand. Data comes from the public GET /bazares/ endpoint.
 */
export function BazaresPage() {
  useSeo({
    title: "Bazares",
    description:
      "Bazares y tianguis de discos donde Moctezuma Records pone stand en la Ciudad de México. Fechas, horarios y ubicación para vernos en persona."
  });
  const { bazares, isLoading, error, retry } = useUpcomingBazares();

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* ── Header ── */}
      <p className="text-xs uppercase tracking-[0.26em] text-orange">
        Vente a vernos en persona
      </p>
      <h1 className="mt-2 font-display text-3xl leading-tight text-denim sm:text-4xl">
        Bazares
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-navy/80 sm:text-base">
        Además de la tienda en línea, ponemos stand en bazares y tianguis de
        discos por la Ciudad de México. Revísanos en persona: escucha antes de
        comprar y llévate tu discazo el mismo día.
      </p>

      {/* ── Content ── */}
      {isLoading ? (
        <BazaresSkeleton />
      ) : error ? (
        <div
          role="alert"
          className="mt-10 rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center"
        >
          <p className="text-sm text-red-700">{error}</p>
          <Button
            tone="outline"
            className="mt-4 px-5 py-2 text-sm"
            onClick={retry}
          >
            Reintentar
          </Button>
        </div>
      ) : bazares.length === 0 ? (
        <EmptyBazares />
      ) : (
        <ul className="mt-8 grid list-none gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bazares.map((bazar) => (
            <li key={bazar.id}>
              <BazarCard bazar={bazar} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BazaresSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {SKELETON_KEYS.map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-3xl border border-navy/10 bg-white/70 shadow-card"
        >
          <div className="aspect-[4/3] animate-pulse bg-navy/10" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-2/3 animate-pulse rounded bg-navy/10" />
            <div className="h-3 w-full animate-pulse rounded bg-navy/10" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-navy/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyBazares() {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-navy/20 bg-cream/60 px-6 py-14 text-center">
      <p className="text-4xl">🎪</p>
      <h2 className="mt-3 font-display text-lg text-denim">
        No hay bazares agendados por ahora
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-navy/70">
        Estamos preparando la siguiente fecha. Mientras tanto síguenos en
        Instagram para enterarte primero del próximo bazar.
      </p>
      <Button
        tone="orange"
        className="mt-5 px-6 py-2.5 text-sm"
        onClick={() => window.open(INSTAGRAM_URL, "_blank", "noopener,noreferrer")}
      >
        💬 Síguenos en Instagram
      </Button>
    </div>
  );
}
