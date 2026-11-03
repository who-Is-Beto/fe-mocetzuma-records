import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { FreshPicks } from "../../components/FreshPicks";
import { primaryCta } from "../../components/cta";
import type { Category } from "../../app/domain/album";

/**
 * Why the catalog came back empty, from most to least specific:
 * - "format": ?category= points at a format we don't have (old/typed link)
 * - "page": ?page= past the last page (the catalog shrank since)
 * - "search": a search found nothing
 * - "filters": the filters combined match nothing
 */
export type EmptyReason = "format" | "page" | "search" | "filters";

type CatalogEmptyProps = {
  reason: EmptyReason;
  search: string;
  /** "Solo disponibles" is on: sold-out records might match. */
  availableOnly: boolean;
  hasFilters: boolean;
  categories: Category[];
  onIncludeSoldOut: () => void;
  onClearFilters: () => void;
  onPickFormat: (slug: string) => void;
  onFirstPage: () => void;
};

const linkButton =
  "min-h-[44px] rounded-pill px-3 text-sm font-semibold text-denim underline decoration-orange/60 underline-offset-4 transition hover:text-orange";

function Panel({ icon, title, text, children }: { icon: string; title: string; text: ReactNode; children: ReactNode }) {
  return (
    <div role="status" className="relative isolate overflow-hidden rounded-[28px] border border-navy/10 bg-cream px-5 py-9 text-center shadow-panel sm:px-10 sm:py-12">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-stripes" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(248,209,90,0.3), transparent 70%)" }}
      />
      <span aria-hidden="true" className="success-pop mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-white text-2xl shadow-card ring-1 ring-navy/10">
        {icon}
      </span>
      <h2 className="mx-auto mt-5 max-w-md font-display text-2xl leading-tight text-denim [overflow-wrap:anywhere]">{title}</h2>
      <div className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-navy/75">{text}</div>
      <div className="mt-7 flex flex-col items-center gap-2 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:justify-center">
        {children}
      </div>
    </div>
  );
}

export function CatalogEmpty({
  reason,
  search,
  availableOnly,
  hasFilters,
  categories,
  onIncludeSoldOut,
  onClearFilters,
  onPickFormat,
  onFirstPage
}: CatalogEmptyProps) {
  const soldOutButton = availableOnly ? (
    <Button tone="navy" className="min-h-[48px] w-full px-6 min-[480px]:w-auto" onClick={onIncludeSoldOut}>
      Buscar también en agotados
    </Button>
  ) : null;

  let panel: ReactNode;
  if (reason === "format") {
    panel = (
      <Panel icon="💿" title="Ese formato no existe" text="Puede que el enlace sea viejo o tenga un error. Elige uno de los formatos que manejamos:">
        <ul className="flex max-w-xl flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => onPickFormat(category.slug)}
                className="min-h-[40px] rounded-pill border border-navy/15 bg-white px-4 text-sm font-semibold text-navy transition hover:-translate-y-0.5 hover:border-orange active:scale-95"
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    );
  } else if (reason === "page") {
    panel = (
      <Panel icon="📄" title="Esta página ya no existe" text="El catálogo cambió desde que abriste este enlace: se vendieron algunos discos.">
        <Button tone="orange" className="min-h-[52px] w-full px-7 min-[480px]:w-auto" onClick={onFirstPage}>
          Ir a la primera página
        </Button>
      </Panel>
    );
  } else if (reason === "search") {
    panel = (
      <Panel
        icon="🔍"
        title={`No encontramos “${search}”`}
        text={
          <>
            Revisa cómo se escribe o prueba solo con el artista.
            {availableOnly ? " Por ahora buscamos solo entre los discos disponibles." : ""}
          </>
        }
      >
        <Link to={`/encargar?title=${encodeURIComponent(search)}`} className={`${primaryCta} w-full min-[480px]:w-auto`}>
          Encárgalo y te lo buscamos
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </Link>
        {soldOutButton}
        {hasFilters ? (
          <button type="button" onClick={onClearFilters} className={linkButton}>
            Quitar filtros
          </button>
        ) : null}
      </Panel>
    );
  } else {
    panel = (
      <Panel
        icon="🎛️"
        title="Nada con estos filtros… por ahora"
        text="El catálogo se mueve cada semana. Quita alguno de los filtros de arriba o empieza de nuevo."
      >
        {soldOutButton}
        <Button tone={availableOnly ? "outline" : "orange"} className="min-h-[48px] w-full px-6 min-[480px]:w-auto" onClick={onClearFilters}>
          Quitar todos los filtros
        </Button>
      </Panel>
    );
  }

  return (
    <div className="page-enter">
      {panel}
      <FreshPicks />
    </div>
  );
}
