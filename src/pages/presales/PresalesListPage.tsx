import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { Presale } from "../../app/domain/presales";
import { useSeo } from "../../app/hooks/useSeo";
import { currency } from "../../app/lib/format";
import { Skeleton } from "../../components/Skeleton";
import { StatusPanel } from "../../components/StatusPanel";
import { primaryCta } from "../../components/cta";
import { PresaleCard } from "../../components/presales/PresaleCard";
import { SubscribeBox } from "../../components/presales/SubscribeBox";
import { minDeposit } from "../../components/presales/presaleText";
import { usePublishedPresales } from "../../components/presales/usePublishedPresales";

const DESCRIPTION =
  "Todas las preventas de vinilos de Moctezuma Records: aparta tu copia con un anticipo, liquida en 120 días y paga menos si pagas completo.";

/** schema.org for the list: the page, its breadcrumb and every presale in order. */
function structuredData(presales: Presale[], origin: string) {
  const url = `${origin}/preventas`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": url,
        url,
        name: "Preventas de vinilos",
        description: DESCRIPTION,
        inLanguage: "es-MX",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: presales.length,
          itemListElement: presales.map((p, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${origin}/preventas/${p.slug}`,
            name: `${p.title} — ${p.artist}`,
            ...(p.cover ? { image: p.cover } : {})
          }))
        }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${origin}/` },
          { "@type": "ListItem", position: 2, name: "Preventas", item: url }
        ]
      }
    ]
  };
}

/**
 * /preventas — every open presale, the home carousel's "see all": one column
 * on phones, two on tablets, three on desktop, soonest to close first.
 */
export function PresalesListPage() {
  const { presales, isLoading } = usePublishedPresales();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const open = presales.filter((p) => p.is_open).length;
  const lowestDeposit = presales.length ? Math.min(...presales.map(minDeposit)) : 0;

  useSeo({
    title: "Preventas de vinilos",
    description: DESCRIPTION,
    image: presales.find((p) => p.cover)?.cover ?? undefined,
    jsonLd: presales.length ? structuredData(presales, origin) : undefined
  });

  return (
    <section aria-labelledby="presales-page-title" className="space-y-8 sm:space-y-10">
      <header className="page-enter">
        <nav aria-label="Ruta" className="text-xs text-navy/60">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link to="/" className="inline-flex min-h-[44px] items-center hover:text-orange">
                Inicio
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-navy/80">
              Preventas
            </li>
          </ol>
        </nav>
        <h1 id="presales-page-title" className="mt-1 font-display text-[2rem] leading-[1.1] text-denim sm:text-4xl lg:text-[2.6rem]">
          Preventas de vinilos
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy/75 sm:text-base">
          Discos que vienen en camino a la tienda. Aparta tu copia con un anticipo y liquida dentro de 120 días; si
          pagas completo desde el inicio, te cuesta menos.
        </p>
        {!isLoading && presales.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-navy" aria-label="Resumen">
            <li className="rounded-pill bg-white/80 px-3 py-1.5 ring-1 ring-navy/10">
              {open} {open === 1 ? "abierta" : "abiertas"}
            </li>
            {lowestDeposit > 0 && (
              <li className="rounded-pill bg-white/80 px-3 py-1.5 ring-1 ring-navy/10">Apartas desde {currency(lowestDeposit)}</li>
            )}
            <li className="rounded-pill bg-white/80 px-3 py-1.5 ring-1 ring-navy/10">120 días para liquidar</li>
          </ul>
        )}
      </header>

      {isLoading ? (
        // Same shapes as what loads: rows on phones, cards from sm (no jump when the list arrives).
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3" aria-busy="true" aria-label="Cargando preventas">
          {Array.from({ length: 6 }, (_, i) => (
            <li
              key={i}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)] overflow-hidden rounded-[22px] ring-1 ring-navy/10 min-[400px]:grid-cols-[8.5rem_minmax(0,1fr)] sm:block"
            >
              <Skeleton className="m-3 mr-0 aspect-square rounded-2xl sm:m-0 sm:w-full sm:rounded-none" />
              <div className="space-y-2 p-3 sm:p-5">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </div>
            </li>
          ))}
        </ul>
      ) : presales.length === 0 ? (
        <StatusPanel
          icon="📀"
          eyebrow="Preventas"
          title="Por ahora no hay preventas abiertas"
          text="Déjanos tu correo y te avisamos el día que abra la próxima."
          actions={
            <Link to="/catalogo" className={primaryCta}>
              Ver el catálogo
            </Link>
          }
          footer={
            <div className="mx-auto mt-2 max-w-md text-left">
              <SubscribeBox variant="compact" />
            </div>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {presales.map((presale, index) => (
            // Cascade in on load (capped), then still: no reveal on scroll.
            <li key={presale.id} style={{ "--i": Math.min(index, 8) } as CSSProperties} className="reveal">
              <PresaleCard presale={presale} priority={index < 2} dense />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PresalesListPage;
