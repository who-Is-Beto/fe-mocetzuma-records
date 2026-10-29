import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Record as RecordItem, RecordPage } from "../../app/domain/album";
import { getEffectivePrice } from "../../app/domain/album";
import type { Bazar } from "../../app/domain/bazares";
import { useServiceQuery } from "../../app/hooks";
import { createRecordService } from "../../app/services/recordService";
import { createBazarService } from "../../app/services/bazarService";
import { useAuth } from "../../app/providers/AuthProvider";
import { useMaintenanceStatusValue } from "../../app/providers/MaintenanceStatusContext";
import { T } from "../../app/i18n/strings";
import { useSeo } from "../../app/hooks/useSeo";
import { currency, formatEventDate, getDateParts } from "../../app/lib/format";
import { Img } from "../../components/Img";
import { Reveal } from "../../components/Reveal";
import { Skeleton } from "../../components/Skeleton";
import { primaryCta, secondaryCta } from "../../components/cta";

const INSTAGRAM_URL = "https://www.instagram.com/moctezuma_records/";

/** Novedades carousel: the newest in-stock records. */
const LATEST_COUNT = 12;

/** Never rejects — useServiceQuery rethrows fetcher errors into unhandled
 *  rejections, so landing fetches degrade to an empty result instead. */
const safePage = async (fetch: () => Promise<RecordPage>): Promise<RecordPage> => {
  try {
    return await fetch();
  } catch {
    return { count: 0, next: null, previous: null, results: [] };
  }
};

const getArtistName = (artist?: string | { name?: string } | null) => {
  if (!artist) return "Artista desconocido";
  return typeof artist === "string" ? artist : artist.name ?? "Artista desconocido";
};

/* Shared pieces of the design language on this page. */
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.22em] text-orange";
const sectionTitle = "font-display text-[1.6rem] leading-[1.15] text-denim sm:text-3xl lg:text-[2.1rem]";
export const HomePage = () => {
  useSeo({
    // null → title stays just "Moctezuma Records" on the landing
    title: null,
    description:
      "Tienda de discos de vinilo en la Ciudad de México: LPs nuevos y coleccionables, rock nacional, importados y joyas usadas con gradación honesta. Envíos a todo México."
  });
  const { token, hasPerm } = useAuth();

  // While the maintenance window is open everyone (including logged-in
  // customers) sees the home shell with a notice instead of the catalog.
  // Admins keep full access.
  const maintenance = useMaintenanceStatusValue();
  const maintenanceBlocked =
    maintenance.config?.maintenance_mode === true && !hasPerm("apiApp.change_siteconfig");

  // Public endpoint, but the token lets the maintenance middleware tell an
  // admin (full access) from a customer (503 while the window is open).
  const bazarService = useMemo(() => createBazarService(), []);
  const recordService = useMemo(
    () => createRecordService({ getToken: () => token ?? null }),
    [token]
  );

  // The newest in-stock records, filtered and limited by the server.
  // `count` is then the number of available records the hero shows.
  const fetchLatest = useCallback(
    () => safePage(() => recordService.list({ page: 1, page_size: LATEST_COUNT, available: true })),
    [recordService]
  );
  const { data: latest, isLoading: latestLoading } = useServiceQuery<RecordPage>(
    [recordService],
    fetchLatest,
    // Skip the query while the window blocks the endpoint for non-admins.
    { enabled: !maintenanceBlocked }
  );
  // A different in-stock record in the hero on every visit (null if none / API down).
  const fetchFeatured = useCallback(() => recordService.featured().catch(() => null), [recordService]);
  const { data: featured, isLoading: featuredLoading } = useServiceQuery<RecordItem | null>(
    [recordService],
    fetchFeatured,
    { enabled: !maintenanceBlocked }
  );

  // Same never-reject rule as safePage: a failed bazar list just hides the card.
  const fetchBazares = useCallback(() => bazarService.getUpcoming().catch(() => [] as Bazar[]), [bazarService]);
  const { data: bazares = [] } = useServiceQuery<Bazar[]>([bazarService], fetchBazares, {
    enabled: !maintenanceBlocked
  });

  const latestRecords = latest?.results ?? [];
  const totalAvailable = Number(latest?.count ?? 0);
  const loading = latestLoading && !maintenanceBlocked;

  return (
    <div className="space-y-16 sm:space-y-20 lg:space-y-24">
      <HomeHero
        totalAvailable={totalAvailable}
        loading={loading}
        featured={featured ?? undefined}
        featuredLoading={featuredLoading && !maintenanceBlocked}
      />

      <Promises />

      {maintenanceBlocked ? (
        <MaintenanceNotice message={maintenance.config?.maintenance_message} />
      ) : (
        <LatestArrivals records={latestRecords} loading={loading} />
      )}

      <AboutStore nextBazar={bazares[0]} />

      <FinalCta hasStock={totalAvailable > 0} />
    </div>
  );
};

/* ── Hero ─────────────────────────────────────────────────────────────── */

function HomeHero({
  totalAvailable,
  loading,
  featured,
  featuredLoading
}: {
  totalAvailable: number;
  loading: boolean;
  featured?: RecordItem;
  featuredLoading: boolean;
}) {
  return (
    <section
      aria-labelledby="home-title"
      className="relative isolate overflow-hidden rounded-[28px] border border-navy/10 bg-cream shadow-panel sm:rounded-[36px]"
    >
      {/* Soft color fields: painted gradients, not blur filters (cheap on phones). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 55% at 100% 0%, rgba(244,144,60,0.22), transparent 70%), radial-gradient(45% 50% at 0% 100%, rgba(248,209,90,0.35), transparent 70%), radial-gradient(40% 40% at 70% 90%, rgba(20,80,122,0.10), transparent 70%)"
        }}
      />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-stripes" />
      <PapelPicado />

      <div className="grid items-center gap-10 px-5 pb-9 pt-14 min-[480px]:px-8 sm:px-10 sm:pb-12 sm:pt-16 lg:grid-cols-12 lg:gap-6 lg:px-14 lg:py-20 xl:px-16">
        <div className="lg:col-span-8">
          <p className={`${eyebrow} flex items-center gap-2`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-orange" />
            Tienda de discos · CDMX
          </p>

          <h1
            id="home-title"
            className="mt-4 break-words font-display text-[2rem] leading-[1.08] text-denim min-[400px]:text-[2.3rem] sm:text-5xl sm:leading-[1.06] lg:text-[2.7rem] lg:leading-[1.08] xl:text-[3.05rem]"
          >
            Encuentra tu próximo <span className="text-orange">discazo</span>, compa
          </h1>

          <p className="mt-5 max-w-[34rem] text-[15px] leading-relaxed text-navy/75 sm:text-lg">
            Vinilos, CDs y rarezas curadas uno por uno, graduadas a mano y listas
            para girar. Pídelos en línea con envío a todo México o recógelos en el
            próximo bazar.
          </p>

          <div className="mt-8 grid gap-3 min-[480px]:flex min-[480px]:flex-wrap">
            <Link to="/catalogo" className={primaryCta}>
              Ver catálogo
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className={secondaryCta}>
              Encargar un disco
            </a>
          </div>

          {/* Fixed height: the count arriving never moves the layout. */}
          <p className="mt-6 flex h-5 items-center gap-2 text-sm text-navy/75" aria-live="polite">
            {loading ? (
              <Skeleton className="h-4 w-48" />
            ) : totalAvailable > 0 ? (
              <>
                <span aria-hidden="true" className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span>
                  <strong className="font-semibold text-navy">{totalAvailable}</strong> discos disponibles ahora
                </span>
              </>
            ) : null}
          </p>
        </div>

        <div className="lg:col-span-4">
          <SleeveArt featured={featured} loading={featuredLoading} />
        </div>
      </div>
    </section>
  );
}

/**
 * A random in-stock record's sleeve with the disc sliding out of it, spinning. Small
 * on phones (the headline stays the largest paint there), full size from `sm`.
 */
function SleeveArt({ featured, loading }: { featured?: RecordItem; loading: boolean }) {
  const sleeve = (
    <div className="relative aspect-square w-full overflow-hidden rounded-[10px] bg-gradient-to-br from-denim via-navy to-charcoal shadow-[0_30px_60px_-24px_rgba(15,63,103,0.6)] ring-1 ring-black/10 transition duration-500 group-hover:-translate-y-1 group-hover:-rotate-1">
      {featured?.cover_image_url ? (
        <Img
          src={featured.cover_image_url}
          thumbs={featured.cover_thumbs}
          alt={`${featured.title} — ${getArtistName(featured.artist)}`}
          width={340}
          sizes="(min-width: 1024px) 340px, (min-width: 640px) 300px, 190px"
          className="h-full w-full object-cover"
        />
      ) : loading ? (
        <Skeleton className="h-full w-full rounded-none" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-display text-3xl text-cream/90">MR</div>
      )}
      {/* Sleeve sheen + worn edge */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-white/20" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/15" />
    </div>
  );

  return (
    <div className="relative mx-auto w-full max-w-[230px] pr-[24%] min-[480px]:max-w-[280px] sm:max-w-[340px] lg:max-w-[360px]">
      {/* The disc: a touch smaller than the sleeve, slid ~1/3 out to the right. */}
      <div key={featured?.id ?? "none"} aria-hidden="true" className="vinyl-out absolute right-0 top-[4%] aspect-square w-[72%]">
        <Vinyl />
      </div>

      {featured ? (
        <Link
          to={`/records/${featured.slug ?? featured.id}`}
          key={featured.id}
          className="sleeve-in group relative block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange"
        >
          {sleeve}
          <span className="absolute -bottom-4 left-3 right-3 flex items-center gap-2 rounded-xl border border-navy/10 bg-white/95 px-3 py-2 shadow-card min-[480px]:left-4 min-[480px]:right-auto min-[480px]:max-w-[90%]">
            <span className="shrink-0 rounded-pill bg-sun px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-navy">
              Destacado
            </span>
            <span className="min-w-0 truncate text-xs font-semibold text-navy">{featured.title}</span>
          </span>
        </Link>
      ) : (
        <div className="relative">{sleeve}</div>
      )}
    </div>
  );
}

/** Charcoal vinyl (grooves + serape label), spinning slowly. */
function Vinyl() {
  return (
    <div
      className="relative h-full w-full animate-[spin_14s_linear_infinite] rounded-full shadow-[0_20px_40px_-18px_rgba(0,0,0,0.6)] motion-reduce:animate-none"
      style={{
        backgroundImage:
          "repeating-radial-gradient(circle at center, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 2px, transparent 4px), linear-gradient(135deg, #1b1f2a, #262b38 55%, #000)"
      }}
    >
      <div className="absolute inset-[9%] rounded-full border border-white/10" />
      <div
        className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white/10"
        style={{
          background:
            "repeating-conic-gradient(from 0deg, #f8d15a 0deg 30deg, #f4903c 30deg 60deg, #e85f3c 60deg 90deg, #e4007c 90deg 120deg)"
        }}
      >
        <span className="absolute left-1/2 top-1/2 h-[14%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream" />
      </div>
      {/* Light catching the grooves */}
      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,transparent_0deg,rgba(255,255,255,0.10)_40deg,transparent_80deg,transparent_200deg,rgba(255,255,255,0.07)_240deg,transparent_280deg)]" />
    </div>
  );
}

/* ── Promises strip ───────────────────────────────────────────────────── */

const PROMISES = [
  { icon: "🎧", title: "Graduación honesta", text: "Cada disco revisado y calificado de Mint a Good." },
  { icon: "📦", title: "Envíos a todo México", text: "Tarifa real de Estafeta, cotizada antes de pagar." },
  { icon: "🔒", title: "Pago seguro", text: "Procesado con Stripe; nunca vemos tu tarjeta." },
  { icon: "🎪", title: "Bazares en la CDMX", text: "Aparta en línea y recoge en el próximo bazar." }
];

function Promises() {
  return (
    <Reveal as="section" className="relative">
      <h2 className="sr-only">Por qué comprar en Moctezuma Records</h2>
      {/* gap-px over a tinted background = hairline dividers that stay crisp at any column count */}
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-[24px] border border-navy/10 bg-navy/10 shadow-card min-[480px]:grid-cols-2 lg:grid-cols-4">
        {PROMISES.map((item) => (
          <li key={item.title} className="flex items-start gap-4 bg-cream p-5 sm:p-6">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sun/50 text-xl">
              {item.icon}
            </span>
            <span>
              <span className="block text-sm font-semibold text-denim">{item.title}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-navy/75">{item.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

/* ── Latest arrivals ──────────────────────────────────────────────────── */

function LatestArrivals({ records, loading }: { records: RecordItem[]; loading: boolean }) {
  return (
    <section aria-labelledby="latest-title">
      <Reveal className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className={eyebrow}>Novedades</p>
          <h2 id="latest-title" className={`mt-2 ${sectionTitle}`}>Recién llegados</h2>
        </div>
        <Link
          to="/catalogo"
          className="group inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-navy transition hover:text-orange"
        >
          Ver todo el catálogo
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </Link>
      </Reveal>

      {loading ? (
        <Carousel label="Cargando los recién llegados" busy>
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className={slideClass}>
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="mt-3 h-3 w-1/2" />
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-2 h-4 w-1/3" />
            </li>
          ))}
        </Carousel>
      ) : records.length > 0 ? (
        <Carousel label="Recién llegados">
          {records.map((record, index) => (
            <Reveal
              as="li"
              key={record.id}
              delay={(index % 4) * 70}
              className={slideClass}
            >
              <RecordTile record={record} />
            </Reveal>
          ))}
        </Carousel>
      ) : (
        <EmptyShelf />
      )}
    </section>
  );
}

/** Slide widths: 2 + a peek on phones, 3 on tablets, 4 on desktop (the peek says "swipe"). */
const slideClass = "w-[44%] shrink-0 snap-start min-[480px]:w-[38%] sm:w-[31%] lg:w-[calc(25%-1.125rem)]";

/**
 * Horizontal carousel on native scrolling: swipe, trackpad and arrow keys
 * just work, slides snap into place. Arrow buttons page by one screenful and
 * a thin bar shows how far along you are. On phones the track bleeds to the
 * screen edges so slides glide out instead of being cut at the gutter.
 */
function Carousel({ label, busy = false, children }: { label: string; busy?: boolean; children: ReactNode }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState({ start: true, end: false, progress: 0, visible: 1 });

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setPosition({
      start: track.scrollLeft <= 4,
      end: track.scrollLeft >= max - 4,
      progress: max > 0 ? track.scrollLeft / max : 0,
      visible: track.scrollWidth > 0 ? track.clientWidth / track.scrollWidth : 1
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, children]);

  const page = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    // One screenful minus a slide, so the last visible slide stays as context.
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  };

  const arrow =
    "flex h-11 w-11 items-center justify-center rounded-full border border-navy/15 bg-cream text-navy shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-orange hover:text-orange disabled:pointer-events-none disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange";

  return (
    <div role="region" aria-roledescription="carrusel" aria-label={label} aria-busy={busy || undefined} className="mt-8">
      <ul
        ref={trackRef}
        onScroll={measure}
        tabIndex={0}
        className="-mx-6 flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 pb-4 pt-1 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-orange/40 sm:gap-5 md:-mx-10 md:scroll-px-10 md:px-10 lg:mx-0 lg:scroll-px-0 lg:gap-6 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>

      {/* Controls: progress bar always (it doubles as a "there's more" hint); arrows from sm */}
      <div className="mt-3 flex items-center gap-4">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-navy/10" aria-hidden="true">
          <div
            className="h-full rounded-full bg-orange transition-[margin,width] duration-300 ease-out"
            style={{
              width: `${Math.max(position.visible, 0.1) * 100}%`,
              marginLeft: `${position.progress * (1 - Math.max(position.visible, 0.1)) * 100}%`
            }}
          />
        </div>
        <div className="hidden gap-2 sm:flex">
          <button type="button" className={arrow} onClick={() => page(-1)} disabled={position.start} aria-label="Discos anteriores">
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" className={arrow} onClick={() => page(1)} disabled={position.end} aria-label="Más discos">
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Cover-first tile: the sleeve does the selling, details stay quiet underneath. */
function RecordTile({ record }: { record: RecordItem }) {
  const { original, effective, hasDiscount, discount } = getEffectivePrice(record);
  return (
    <Link
      to={`/records/${record.slug ?? record.id}`}
      className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-sand shadow-card ring-1 ring-navy/10 transition duration-500 ease-out group-hover:-translate-y-1 group-hover:shadow-panel">
        {record.cover_image_url ? (
          <Img
            src={record.cover_image_url}
            thumbs={record.cover_thumbs}
            alt={`${record.title} — ${getArtistName(record.artist)}`}
            width={280}
            sizes="(min-width: 1024px) 260px, (min-width: 640px) 31vw, 46vw"
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl" aria-hidden="true">🎵</div>
        )}
        {hasDiscount ? (
          <span className="absolute left-2.5 top-2.5 rounded-pill bg-coral px-2 py-0.5 text-[11px] font-bold text-white shadow">
            -{discount}%
          </span>
        ) : null}
        {record.condition ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-pill bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-navy shadow-sm">
            {record.condition}
          </span>
        ) : null}
      </div>
      <div className="mt-3 px-0.5">
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-navy/75">
          {getArtistName(record.artist)}
        </p>
        <h3 className="mt-1 line-clamp-2 font-display text-[13px] leading-snug text-denim transition group-hover:text-orange sm:text-sm">
          {record.title}
        </h3>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className={`font-semibold ${hasDiscount ? "text-orange" : "text-navy"}`}>
            {currency(hasDiscount ? effective : original)}
          </span>
          {hasDiscount ? <s className="text-xs text-navy/60">{currency(original)}</s> : null}
        </p>
      </div>
    </Link>
  );
}

/* ── About the store ──────────────────────────────────────────────────── */

const PRINCIPLES = [
  { title: "Curaduría uno por uno", text: "Nada de relleno: cada disco entra porque vale la pena." },
  { title: "Gradación honesta", text: "Del Mint al Good, con fotos y notas cuando hace falta." },
  { title: "Encargos especiales", text: "¿Buscas ese disco imposible? Escríbenos y lo cazamos." }
];

function AboutStore({ nextBazar }: { nextBazar?: Bazar }) {
  return (
    <section aria-labelledby="about-title" className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <Reveal className="lg:col-span-7">
        <p className={eyebrow}>Sobre la tienda</p>
        <h2 id="about-title" className={`mt-2 ${sectionTitle}`}>
          De coleccionista para coleccionista
        </h2>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-navy/80 sm:text-base">
          <p className="border-l-2 border-orange pl-5 font-display text-base leading-relaxed text-denim sm:text-lg">
            Yo también compro discos y estoy harto de que siempre estén por las nubes.
          </p>
          <p>
            Por eso abrí la tienda, inspirado en una pequeña tienda de discos que había
            cerca de mi casa, en la colonia Moctezuma de la Ciudad de México — la
            colonia que me vio crecer.
          </p>
          <p>
            La idea es crear un espacio que conecte con la música más allá de un negocio
            vacío y sin alma: buscamos los mejores precios, sin olvidar que es un negocio,
            y trabajamos día a día para darte la mejor experiencia posible.
          </p>
          <p className="font-display text-lg text-orange">Bienvenidx 🎶</p>
        </div>
      </Reveal>

      <Reveal className="space-y-4 lg:col-span-5" delay={100}>
        <ol className="divide-y divide-navy/10 rounded-[24px] border border-navy/10 bg-cream shadow-card">
          {PRINCIPLES.map((item, index) => (
            <li key={item.title} className="flex gap-4 p-5">
              <span aria-hidden="true" className="font-display text-sm text-orange">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="block text-sm font-semibold text-denim">{item.title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-navy/75">{item.text}</span>
              </span>
            </li>
          ))}
        </ol>

        {nextBazar ? <NextBazar bazar={nextBazar} /> : null}

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-4 rounded-[24px] border border-orange/25 bg-sun/40 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange"
        >
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-xl">💬</span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-denim">@moctezuma_records</span>
            <span className="block text-[13px] text-navy/75">Nuevos ingresos, bazares y encargos por DM.</span>
          </span>
          <span aria-hidden="true" className="ml-auto text-navy/40 transition-transform duration-300 group-hover:translate-x-1">→</span>
        </a>
      </Reveal>
    </section>
  );
}

function NextBazar({ bazar }: { bazar: Bazar }) {
  const date = getDateParts(bazar.date);
  return (
    <Link
      to="/bazares"
      className="group flex items-center gap-4 rounded-[24px] border border-navy/10 bg-white/80 p-5 shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-orange/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange"
    >
      {date ? (
        <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-navy text-cream">
          <span className="font-display text-lg leading-none">{date.day}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sun">{date.month}</span>
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-orange">Próximo bazar</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-denim">{bazar.name}</span>
        <span className="block truncate text-[13px] text-navy/75">
          {formatEventDate(bazar.date)}
          {bazar.schedule ? ` · ${bazar.schedule}` : ""}
        </span>
      </span>
      <span aria-hidden="true" className="ml-auto text-navy/40 transition-transform duration-300 group-hover:translate-x-1">→</span>
    </Link>
  );
}

/* ── Closing band ─────────────────────────────────────────────────────── */

function FinalCta({ hasStock }: { hasStock: boolean }) {
  return (
    <Reveal
      as="section"
      className="relative isolate overflow-hidden rounded-[28px] bg-navy px-6 py-14 text-center shadow-panel sm:rounded-[36px] sm:px-12 sm:py-20"
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-stripes" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 70% at 85% 0%, rgba(244,144,60,0.35), transparent 70%), radial-gradient(40% 60% at 10% 100%, rgba(248,209,90,0.18), transparent 70%)"
        }}
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sun">
        {hasStock ? "Sí hay buenos discos, y bien puestos" : "Catálogo reabriendo pronto"}
      </p>
      <h2 className="mx-auto mt-4 max-w-2xl font-display text-[1.6rem] leading-[1.15] text-cream sm:text-4xl">
        {hasStock
          ? "Échale un ojo al catálogo completo, no te vas a arrepentir"
          : "El catálogo se repone cada semana — vuelve muy pronto"}
      </h2>
      <div className="mt-9 grid gap-3 min-[480px]:flex min-[480px]:justify-center">
        <Link to="/catalogo" className={primaryCta}>
          Ver catálogo
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </Link>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[52px] items-center justify-center rounded-pill border border-cream/25 px-7 text-sm font-semibold text-cream transition duration-300 hover:-translate-y-0.5 hover:border-sun hover:text-sun focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sun"
        >
          Síguenos en Instagram
        </a>
      </div>
    </Reveal>
  );
}

/* ── Supporting pieces ────────────────────────────────────────────────── */

/** Papel picado flags — pure CSS, chilango mercado vibes. */
const FLAG_COLORS = ["#f8d15a", "#f4903c", "#e85f3c", "#e4007c", "#2e9e6b"];

function PapelPicado() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-1.5 z-10 flex justify-between px-4 sm:px-10"
    >
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          // Every other flag drops on phones so the string doesn't look crowded.
          className={`block h-6 w-4 origin-top opacity-90 sm:h-7 sm:w-5 ${i % 2 ? "max-sm:hidden" : ""}`}
          style={{
            backgroundColor: FLAG_COLORS[i % FLAG_COLORS.length],
            clipPath: "polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)",
            transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)`
          }}
        />
      ))}
    </div>
  );
}

/** Home stays visible during maintenance, but the catalog section is replaced
 *  with a notice (the middleware blocks non-admins with 503 anyway). The
 *  status polls silently, so the catalog returns on its own once the window
 *  closes — no reload button needed. */
function MaintenanceNotice({ message }: { message?: string }) {
  return (
    <div className="relative isolate overflow-hidden rounded-[28px] border border-orange/25 bg-gradient-to-br from-sun/40 via-cream to-sand px-6 py-12 text-center shadow-panel sm:px-10 sm:py-16">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-2 bg-stripes opacity-90" />
      <div className="text-5xl">🛠️</div>
      <h2 className="mt-4 font-display text-2xl text-denim sm:text-3xl">
        {T.maintenance.homeTitle}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-navy/75 sm:text-base">
        {message?.trim() || T.maintenance.homeBody}
      </p>
    </div>
  );
}

/** Soft fallback so an API hiccup never blanks the storefront. */
function EmptyShelf() {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 rounded-[24px] border border-navy/10 bg-cream px-6 py-12 text-center shadow-card">
      <span className="text-4xl" aria-hidden="true">💿</span>
      <p className="font-display text-lg text-denim">Estamos surtiendo el catálogo</p>
      <p className="max-w-md text-sm text-navy/75">
        No pudimos cargar los últimos ingresos en este momento, pero el
        catálogo completo sigue en línea.
      </p>
      <Link to="/catalogo" className={`${secondaryCta} mt-2`}>
        Ir al catálogo
      </Link>
    </div>
  );
}

export default HomePage;
