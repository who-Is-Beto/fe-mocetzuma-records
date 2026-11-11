import { useCallback, useMemo } from "react";
import type { Presale } from "../../app/domain/presales";
import { useServiceQuery } from "../../app/hooks";
import { createPresaleService } from "../../app/services/presaleService";
import { Reveal } from "../Reveal";
import { Skeleton } from "../Skeleton";
import { PresaleCard } from "./PresaleCard";
import { daysUntil } from "./presaleText";
import { SubscribeBox } from "./SubscribeBox";

const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.22em] text-orange";
const sectionTitle = "font-display text-[1.6rem] leading-[1.15] text-denim sm:text-3xl lg:text-[2.1rem]";

/**
 * Home → Preventas: published presales still before their deadline (open ones
 * first), plus the announcement sign-up. Renders nothing when there's none.
 */
export function PresalesSection() {
  const service = useMemo(() => createPresaleService(), []);
  // A failed list just hides the section: the rest of the home still works.
  const fetchPresales = useCallback(() => service.list().catch(() => [] as Presale[]), [service]);
  const { data, isLoading } = useServiceQuery<Presale[]>([service], fetchPresales);

  // Closed ones drop off; sold-out ones stay until their date (open ones first).
  const presales = (data ?? [])
    .filter((p) => daysUntil(p.purchase_deadline) >= 0)
    .sort((a, b) => Number(b.is_open) - Number(a.is_open));
  if (!isLoading && presales.length === 0) return null;
  const featured = presales.length === 1;

  return (
    <section aria-labelledby="presales-title">
      <Reveal className="max-w-2xl">
        <p className={eyebrow}>Preventas</p>
        <h2 id="presales-title" className={`mt-2 ${sectionTitle}`}>
          Discos que vienen en camino
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-navy/75 sm:text-base">
          Aparta tu copia con un anticipo y liquida cuando quieras dentro de 120 días. Si pagas completo desde el
          inicio, te cuesta menos.
        </p>
      </Reveal>

      <div className={`mt-8 grid gap-5 sm:gap-6 ${featured ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {isLoading
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-[22px] ring-1 ring-navy/10">
                <Skeleton className="aspect-square w-full rounded-none" />
                <div className="space-y-2 p-5">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))
          : presales.map((presale, index) => (
              <Reveal key={presale.id} delay={(index % 3) * 80} className="h-full">
                <PresaleCard presale={presale} featured={featured} />
              </Reveal>
            ))}
      </div>

      <div className="mt-8">
        <SubscribeBox />
      </div>
    </section>
  );
}
