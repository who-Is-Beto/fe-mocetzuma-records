import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Presale } from "../../app/domain/presales";
import { Carousel } from "../Carousel";
import { Img } from "../Img";
import { Reveal } from "../Reveal";
import { Skeleton } from "../Skeleton";
import { PresaleCard } from "./PresaleCard";
import { usePublishedPresales } from "./usePublishedPresales";

/** The home shows this many; more go to /preventas. */
const HOME_PRESALES = 6;

const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.22em] text-orange";
const sectionTitle = "font-display text-[1.6rem] leading-[1.15] text-denim sm:text-3xl lg:text-[2.1rem]";
/** Presale cards are richer than record tiles: 1 + a peek on phones, 2 on tablets, 3 on desktop. */
const slideClass =
  "w-[84%] shrink-0 snap-start min-[480px]:w-[62%] sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3rem)/3)]";

/**
 * Home → Preventas: the open presales in a carousel (one alone gets the wide
 * card). Past HOME_PRESALES, the last slide and a link lead to /preventas.
 * Renders nothing when there's none.
 */
export function PresalesSection() {
  const { presales, isLoading } = usePublishedPresales();

  // "Agregar otra preventa" lands here (/#preventas) once the list has loaded.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === "#preventas" && !isLoading) document.getElementById("preventas")?.scrollIntoView({ behavior: "smooth" });
  }, [hash, isLoading]);
  if (!isLoading && presales.length === 0) return null;

  const shown = presales.slice(0, HOME_PRESALES);
  const rest = presales.slice(HOME_PRESALES);

  return (
    <section id="preventas" aria-labelledby="presales-title" className="scroll-mt-28">
      <Reveal className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-2xl">
          <p className={eyebrow}>Preventas</p>
          <h2 id="presales-title" className={`mt-2 ${sectionTitle}`}>
            Discos que vienen en camino
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-navy/75 sm:text-base">
            Aparta tu copia con un anticipo y liquida cuando quieras dentro de 120 días. Si pagas completo desde el
            inicio, te cuesta menos.
          </p>
        </div>
        {rest.length > 0 && <SeeAllLink total={presales.length} />}
      </Reveal>

      {isLoading ? (
        <Carousel label="Cargando las preventas" busy>
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className={slideClass}>
              <div className="overflow-hidden rounded-[22px] ring-1 ring-navy/10">
                <Skeleton className="aspect-square w-full rounded-none" />
                <div className="space-y-2 p-5">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </li>
          ))}
        </Carousel>
      ) : presales.length === 1 ? (
        <Reveal className="mt-8">
          <PresaleCard presale={presales[0]} featured />
        </Reveal>
      ) : (
        <Carousel label="Preventas abiertas" prevLabel="Preventas anteriores" nextLabel="Más preventas">
          {shown.map((presale, index) => (
            <Reveal as="li" key={presale.id} delay={(index % 3) * 80} className={slideClass}>
              <PresaleCard presale={presale} />
            </Reveal>
          ))}
          {rest.length > 0 && (
            <li className={slideClass}>
              <SeeAllCard rest={rest} total={presales.length} />
            </li>
          )}
        </Carousel>
      )}
    </section>
  );
}

function SeeAllLink({ total }: { total: number }) {
  return (
    <Link
      to="/preventas"
      className="group inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-navy transition hover:text-orange"
    >
      Ver las {total} preventas
      <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none">
        →
      </span>
    </Link>
  );
}

/** Last slide when there are more than the home shows: the covers still to see, stacked like records in a crate. */
function SeeAllCard({ rest, total }: { rest: Presale[]; total: number }) {
  const covers = rest.filter((p) => p.cover).slice(0, 3);
  const offsets = ["group-hover:-translate-y-1", "translate-y-3 group-hover:translate-x-3", "translate-y-6 group-hover:translate-x-6"];
  return (
    <Link
      to="/preventas"
      className="group relative flex h-full min-h-[22rem] flex-col justify-end overflow-hidden rounded-[22px] bg-navy p-6 text-cream shadow-card ring-1 ring-navy/10 transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-stripes" />
      <span aria-hidden="true" className="absolute inset-x-6 top-8 flex justify-center">
        {covers.map((p, i) => (
          <span
            key={p.id}
            style={{ zIndex: covers.length - i }}
            className={`-ml-10 block aspect-square w-32 overflow-hidden rounded-xl bg-sand shadow-panel ring-2 ring-navy transition-transform duration-500 ease-out first:ml-0 motion-reduce:transition-none sm:w-36 ${offsets[i]}`}
          >
            <Img src={p.cover as string} alt="" width={160} className="h-full w-full object-cover" />
          </span>
        ))}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange">+{rest.length} más</span>
      <span className="mt-1 font-display text-2xl leading-tight">Ver las {total} preventas</span>
      <span className="mt-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-pill bg-orange px-6 text-sm font-semibold text-charcoal transition group-hover:bg-amber">
        Ver todas
        <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none">→</span>
      </span>
    </Link>
  );
}
