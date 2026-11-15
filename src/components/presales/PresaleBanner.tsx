import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Presale } from "../../app/domain/presales";
import { useServiceQuery } from "../../app/hooks";
import { currency } from "../../app/lib/format";
import { createPresaleService } from "../../app/services/presaleService";
import { Img } from "../Img";
import { closingLabel, daysUntil, minDeposit } from "./presaleText";

const DISMISSED_KEY = "moctezuma-presale-banner-dismissed";

const readDismissed = (): boolean => {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

/** One presale: its cover, title and how long is left. Lifts and zooms on hover. */
function PresalePill({ presale, index, wide }: { presale: Presale; index: number; wide: boolean }) {
  const soon = daysUntil(presale.purchase_deadline) <= 3;
  return (
    <Link
      to={`/preventas/${presale.slug}`}
      style={{ animationDelay: `${120 + index * 70}ms` }}
      className={`group flex min-h-[44px] shrink-0 snap-start animate-toast-in items-center gap-2.5 rounded-pill bg-cream/10 py-1 pl-1 pr-3.5 ring-1 ring-cream/15 transition duration-300 hover:-translate-y-0.5 hover:bg-cream/15 hover:ring-orange/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange active:translate-y-0 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        wide ? "max-w-full" : "max-w-[12.5rem] sm:max-w-[17rem]"
      }`}
    >
      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-cream/20 ring-2 ring-orange/80">
        {presale.cover ? (
          <Img
            src={presale.cover}
            alt=""
            width={36}
            placeholder={false}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.08] motion-reduce:group-hover:scale-100"
          />
        ) : null}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-semibold text-cream">{presale.title}</span>
        <span className={`block truncate text-[11px] ${soon ? "font-semibold text-sun" : "text-cream/70"}`}>
          {closingLabel(presale.purchase_deadline)}
          {wide ? ` · apártalo desde ${currency(minDeposit(presale))}` : ""}
        </span>
      </span>
      <span aria-hidden="true" className="ml-1 shrink-0 text-sun transition-transform duration-300 group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

/**
 * Bar above the navbar with every open presale (soonest to close first), each
 * a pill with its cover. Several scroll sideways on a phone. Hidden on
 * presale pages and in Administración; closing it lasts until the browser
 * closes, so each new visit sees it again.
 */
export function PresaleBanner() {
  const { pathname } = useLocation();
  const service = useMemo(() => createPresaleService(), []);
  // A failed list just hides the banner.
  const fetchPresales = useCallback(() => service.list().catch(() => [] as Presale[]), [service]);
  const { data } = useServiceQuery<Presale[]>([service], fetchPresales);
  const [dismissed, setDismissed] = useState(readDismissed);

  const open = (data ?? [])
    .filter((p) => p.is_open && daysUntil(p.purchase_deadline) >= 0)
    .sort((a, b) => a.purchase_deadline.localeCompare(b.purchase_deadline));
  if (dismissed || open.length === 0 || pathname.startsWith("/preventas") || pathname.startsWith("/admin")) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage blocked: it just comes back on the next page load.
    }
  };
  const single = open.length === 1;

  return (
    <aside
      aria-label="Preventas abiertas"
      className="relative z-40 animate-banner-in overflow-hidden bg-navy text-cream motion-reduce:animate-none"
    >
      {/* The brand stripe along the bottom */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-stripes" />

      <div className="relative mx-auto flex max-w-6xl items-center gap-3 py-2 pl-4 pr-1 md:px-10">
        <p className="flex shrink-0 flex-col leading-none">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-orange">
            Preventa{single ? "" : "s"}
            {!single && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] tracking-normal text-charcoal sm:hidden">
                {open.length}
              </span>
            )}
          </span>
          <span className="mt-1 hidden text-xs text-cream/75 sm:block">
            {single ? "Aparta antes de que cierre" : `${open.length} abiertas · aparta la tuya`}
          </span>
        </p>

        {/* Scrolls sideways when the pills don't fit; the fade says there's more */}
        <ul
          className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ maskImage: single ? undefined : "linear-gradient(90deg, #000 85%, transparent)" }}
        >
          {open.map((presale, index) => (
            <li key={presale.id} className={`flex ${single ? "min-w-0" : ""}`}>
              <PresalePill presale={presale} index={index} wide={single} />
            </li>
          ))}
          {!single && <li aria-hidden="true" className="w-6 shrink-0" />}
        </ul>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Ocultar preventas"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-cream/70 transition hover:rotate-90 hover:bg-cream/10 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange motion-reduce:hover:rotate-0"
        >
          ×
        </button>
      </div>
    </aside>
  );
}
