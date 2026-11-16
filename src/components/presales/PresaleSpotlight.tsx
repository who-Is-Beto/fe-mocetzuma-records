import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import type { Presale } from "../../app/domain/presales";
import { useServiceQuery } from "../../app/hooks";
import { createPresaleService } from "../../app/services/presaleService";
import { Img } from "../Img";
import { PresaleCard } from "./PresaleCard";
import { closingLabel, matchPresales } from "./presaleText";

type Props = { query: string; className?: string };

/**
 * Search results / artist page: a presale of what was searched goes first, big,
 * before the catalog. Renders nothing when no presale matches.
 */
export function PresaleSpotlight({ query, className = "" }: Props) {
  const service = useMemo(() => createPresaleService(), []);
  const fetchPresales = useCallback(() => service.list().catch(() => [] as Presale[]), [service]);
  const { data } = useServiceQuery<Presale[]>([service], fetchPresales);
  const matches = matchPresales(data ?? [], query).slice(0, 2);
  if (matches.length === 0) return null;

  return (
    <section aria-label="En preventa" className={`rounded-[26px] bg-navy p-2 shadow-panel sm:p-3 ${className}`}>
      <p className="flex items-center gap-2 px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-orange sm:px-2">
        <span aria-hidden="true" className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-orange" />
        </span>
        {matches.length === 1 ? "En preventa · apártalo antes de que llegue" : "En preventa"}
      </p>
      <div className={`grid gap-2 sm:gap-3 ${matches.length > 1 ? "md:grid-cols-2" : ""}`}>
        {matches.map((presale) => (
          <PresaleCard key={presale.id} presale={presale} featured={matches.length === 1} />
        ))}
      </div>
    </section>
  );
}

/** Search typeahead: matching presales as a highlighted row above the record suggestions. */
export function PresaleSuggestion({ query, onPick }: { query: string; onPick: () => void }) {
  const service = useMemo(() => createPresaleService(), []);
  const fetchPresales = useCallback(() => service.list().catch(() => [] as Presale[]), [service]);
  const { data } = useServiceQuery<Presale[]>([service], fetchPresales);
  const matches = matchPresales(data ?? [], query).slice(0, 2);
  if (matches.length === 0) return null;
  return (
    <ul aria-label="Preventas" className="border-b border-navy/10 bg-navy p-1.5">
      {matches.map((p) => (
        <li key={p.id}>
          <Link
            to={`/preventas/${p.slug}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPick}
            className="flex min-h-[52px] items-center gap-3 rounded-xl px-2 py-1.5 text-cream transition hover:bg-cream/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange"
          >
            {p.cover ? (
              <Img src={p.cover} alt="" width={40} className="h-10 w-10 shrink-0 rounded-lg object-cover ring-2 ring-orange" />
            ) : (
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cream/10">💿</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.title}</span>
              <span className="block truncate text-xs text-cream/70">{p.artist} · {closingLabel(p.purchase_deadline)}</span>
            </span>
            <span className="shrink-0 rounded-pill bg-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal">
              Preventa
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
