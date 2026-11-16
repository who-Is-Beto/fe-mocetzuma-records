import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import type { Presale } from "../../app/domain/presales";
import { useServiceQuery } from "../../app/hooks";
import { createPresaleService } from "../../app/services/presaleService";
import { Img } from "../Img";
import { currency } from "../../app/lib/format";
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
    <section
      aria-label="En preventa"
      className={`flex flex-col gap-1.5 rounded-2xl bg-navy p-1.5 shadow-panel sm:flex-row sm:flex-wrap ${className}`}
    >
      {matches.map((p) => (
        <Link
          key={p.id}
          to={`/preventas/${p.slug}`}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-cream transition hover:bg-cream/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange sm:min-w-[18rem]"
        >
          {p.cover ? (
            <Img src={p.cover} alt="" width={56} className="h-12 w-12 shrink-0 rounded-lg object-cover ring-2 ring-orange" />
          ) : (
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cream/10">💿</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-orange">
              <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange" />
              </span>
              En preventa
            </span>
            <span className="block truncate text-sm font-semibold">{p.title}</span>
            <span className="block truncate text-xs text-cream/70">
              {p.artist} · {closingLabel(p.purchase_deadline)}
            </span>
          </span>
          <span className="shrink-0 rounded-pill bg-orange px-3 py-1.5 text-xs font-semibold text-charcoal transition group-hover:bg-amber">
            Apártalo<span className="hidden min-[400px]:inline">{p.price_from ? ` · ${currency(p.price_from)}` : ""}</span>
          </span>
        </Link>
      ))}
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
