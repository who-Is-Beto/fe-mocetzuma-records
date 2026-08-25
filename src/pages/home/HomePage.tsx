import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import type { Record as RecordItem, RecordPage } from "../../app/domain/album";
import { getEffectivePrice } from "../../app/domain/album";
import { useServiceQuery } from "../../app/hooks";
import { createRecordService } from "../../app/services/recordService";
import { useSeo } from "../../app/hooks/useSeo";

const INSTAGRAM_URL = "https://www.instagram.com/moctezuma_records/";

/** Never rejects — useServiceQuery rethrows fetcher errors into unhandled
 *  rejections, so landing fetches degrade to an empty result instead. */
const safePage = async (
  fetch: () => Promise<RecordPage | RecordItem[]>
): Promise<RecordPage> => {
  try {
    const payload = await fetch();
    if (Array.isArray(payload)) {
      return { count: payload.length, next: null, previous: null, results: payload };
    }
    return {
      count: payload.count ?? payload.results?.length ?? 0,
      next: payload.next ?? null,
      previous: payload.previous ?? null,
      results: payload.results ?? []
    };
  } catch {
    return { count: 0, next: null, previous: null, results: [] };
  }
};

export const HomePage = () => {
  useSeo({
    // null → title stays just "Moctezuma Records" on the landing
    title: null,
    description:
      "Tienda de discos de vinilo en la Ciudad de México: LPs nuevos y coleccionables, rock nacional, importados y joyas usadas con gradación honesta. Envíos a todo México."
  });
  const navigate = useNavigate();

  const recordService = useMemo(() => createRecordService({}), []);

  // Últimos ingresos — first catalog page is also the newest stock.
  const fetchLatest = useCallback(
    () => safePage(() => recordService.list({ page: 1 })),
    [recordService]
  );
  const { data: latest, isLoading: latestLoading } = useServiceQuery<RecordPage>(
    [recordService],
    fetchLatest
  );

  const latestRecords = (latest?.results ?? []).filter((r) => r.stock > 0).slice(0, 6);
  const totalAvailable = Number(latest?.count ?? 0);

  return (
    <section className="space-y-10 md:space-y-14">
      <HomeHero totalAvailable={totalAvailable} />

      {/* ── Últimos ingresos ── */}
      <div className="space-y-5">
        <SectionHeader
          kicker="Novedades recién llegadas"
          title="Lo último agregado al catálogo"
          action={{ label: "Ver catálogo completo", to: "/catalogo" }}
        />

        {latestLoading ? (
          <div className="flex h-[220px] items-center justify-center rounded-[24px] border border-navy/10 bg-cream/60 shadow-card backdrop-blur">
            <Loader />
          </div>
        ) : latestRecords.length > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {latestRecords.map((record, index) => (
                <CompactRecordCard key={record.id} record={record} priority={index < 3} />
              ))}
            </div>
            <div className="flex justify-center pt-2">
              <Button tone="navy" className="px-8 py-3" onClick={() => navigate("/catalogo")}>
                Explorar todo el catálogo
              </Button>
            </div>
          </>
        ) : (
          <EmptyShelf />
        )}
      </div>

      {/* ── Sobre la tienda ── */}
      <div className="rounded-[28px] border border-navy/10 bg-cream/70 p-6 shadow-panel backdrop-blur-md sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.22em] text-orange">
              Sobre la tienda
            </p>
            <h2 className="font-display text-2xl leading-snug text-denim sm:text-3xl">
              De coleccionita para coleccionista
            </h2>
            <p className="text-sm leading-relaxed text-navy/80 sm:text-base">
              La idea de la tienda nació por el mismo consumo de discos: yo
              también compro discos y estoy harto de que siempre estén por las
              nubes, así que decidí abrir mi tienda inspirándome en una
              pequeña tienda de discos que había cerca de mi casa, en la
              colonia Moctezuma, Ciudad de México — la colonia que me vio
              crecer.
            </p>
            <p className="text-sm leading-relaxed text-navy/80 sm:text-base">
              La idea es crear un espacio que conecte la música más allá de un
              negocio vacío y sin alma; tratamos de tener los mejores precios,
              sin olvidar que es un negocio, pero trabajamos día a día para
              darte la mejor experiencia posible.
            </p>
            <p className="font-display text-lg text-denim">
              Bienvenidx 🎶
            </p>
            <ul className="space-y-1.5 pt-1 text-sm font-semibold text-navy">
              <li>✓ Curaduría uno por uno, nada de relleno</li>
              <li>✓ Graduación honesta del Mint al Good</li>
              <li>✓ Encargos especiales de ese disco imposible</li>
            </ul>
          </div>

          <div className="space-y-3">
            <InfoBox icon="🏛️" title="Bazares CDMX" text="Nos encuentras en los mejores bazares y ferias de la ciudad. Síguenos para enterarte de la próxima fecha." />
            <InfoBox icon="📦" title="Envíos a todo México" text="Tarifas reales con Estafeta cotizadas antes de pagar; recogida en bazar disponible." />
            <InfoBox icon="🔒" title="Pago seguro" text="Compras procesadas con Stripe. Nunca guardamos los datos de tu tarjeta." />
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-orange/20 bg-sun/40 p-4 transition hover:-translate-y-0.5 hover:border-orange"
            >
              <span className="text-2xl" aria-hidden="true">💬</span>
              <span>
                <span className="block text-sm font-semibold text-denim">
                  @moctezuma_records
                </span>
                <span className="block text-xs text-navy/70">
                  Nuevos ingresos, bazares y encargos por DM.
                </span>
              </span>
              <span aria-hidden="true" className="ml-auto text-navy/40">➜</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── CTA final ── */}
      <FinalCta hasStock={totalAvailable > 0} />
    </section>
  );
};

/** Welcome band — cream glass panel, DS vinyl art, catalog-first CTAs. */
function HomeHero({ totalAvailable }: { totalAvailable: number }) {
  const navigate = useNavigate();

  return (
    <div className="relative isolate overflow-hidden rounded-[28px] border border-navy/10 bg-cream/70 px-4 py-7 shadow-panel backdrop-blur-md min-[480px]:px-6 sm:px-10 sm:py-12">
      {/* papel picado + stripes ribbon on the top edge */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-2 bg-stripes opacity-90" />
      <PapelPicado />
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-sun/30 blur-3xl" />

      <div className="grid items-center gap-8 lg:grid-cols-[1fr,minmax(220px,300px)] lg:gap-10">
        <div className="space-y-5 pt-7">
          <p className="text-xs uppercase tracking-[0.26em] text-orange">
            Tienda de discos · CDMX
          </p>

          <h1 className="break-words font-display text-3xl leading-tight text-denim sm:text-4xl lg:text-5xl">
            Encuentra tu próximo{" "}
            <span className="text-orange">discazo</span>, compa
          </h1>

          <p className="max-w-xl text-sm leading-relaxed text-navy/80 sm:text-base">
            Vinilos, CDs y rarezas curadas uno por uno, graduadas a mano y
            listas para girar. Pídelos en línea con envío a todo México o
            véntelos a buscar al próximo bazar.
          </p>

          <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center">
            <Button
              tone="orange"
              className="w-full px-6 py-3 text-sm min-[480px]:w-auto"
              onClick={() => navigate("/catalogo")}
            >
              Ver catálogo
            </Button>
            <Button
              tone="outline"
              className="w-full px-6 py-3 text-sm min-[480px]:w-auto"
              onClick={() => window.open(INSTAGRAM_URL, "_blank")}
            >
              💬 Encargar un disco
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Pill>🎧 Graduación honesta</Pill>
            <Pill>📦 Envíos a todo México</Pill>
            <Pill>🔒 Pago seguro</Pill>
            {totalAvailable > 0 ? (
              <Pill>
                <span className="text-orange">●</span> {totalAvailable} discos en vitrina
              </Pill>
            ) : null}
          </div>
        </div>

        <VinylArt />
      </div>
    </div>
  );
}

/** Charcoal vinyl in the DesignSystem style (gradient + white rings), spinning slowly. */
function VinylArt() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[200px] min-[480px]:max-w-[240px] sm:max-w-[260px]">
      <div
        aria-hidden="true"
        className="h-full w-full animate-[spin_18s_linear_infinite] motion-reduce:animate-none rounded-full bg-gradient-to-br from-charcoal via-neutral-800 to-black shadow-card"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at center, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 2px, transparent 4px), linear-gradient(to bottom right, #1b1f2a, #262b38, #000)"
        }}
      >
        <div className="absolute inset-[10%] rounded-full border border-white/10" />
        <div className="absolute inset-[22%] rounded-full border border-white/20 bg-white/5 shadow-inner" />
        {/* serape color-wheel label — spins into a hypnotic concha of colors */}
        <div
          className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-inner ring-4 ring-white/15"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, #f8d15a 0deg 30deg, #f4903c 30deg 60deg, #e85f3c 60deg 90deg, #e4007c 90deg 120deg)"
          }}
        >
          {/* spindle hole */}
          <span className="absolute left-1/2 top-1/2 h-[14%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow-sm ring-2 ring-black/10" />
        </div>
      </div>

      {/* floating badges stay readable because they sit outside the spin;
          tucked inside on small screens so they never clip past the panel */}
      <span className="absolute left-0 top-1 rotate-[-6deg] rounded-pill border border-navy/10 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-denim shadow-card min-[480px]:-left-3 min-[480px]:top-2 min-[480px]:px-3">
        🆕 Ingresos cada semana
      </span>
      <span className="absolute bottom-2 right-0 rotate-[5deg] rounded-pill border border-navy/10 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-denim shadow-card min-[480px]:-right-2 min-[480px]:bottom-3 min-[480px]:px-3">
        🎧 Escuchado antes de venderse
      </span>
    </div>
  );
}

function InfoBox({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-navy/10 bg-white/80 p-4 shadow-inner">
      <span className="text-xl" aria-hidden="true">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-denim">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-navy/70">{text}</span>
      </span>
    </div>
  );
}

function FinalCta({ hasStock }: { hasStock: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="relative isolate overflow-hidden rounded-[28px] border border-orange/25 bg-gradient-to-br from-sun/60 via-cream to-sand px-6 py-10 text-center shadow-panel sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-coral/25 blur-3xl"
      />
      <div className="relative space-y-4">
        <p className="text-xs uppercase tracking-[0.22em] text-orange">
          {hasStock ? "Sí hay buenos discos, y bien puestos" : "Vitrina reabriendo pronto"}
        </p>
        <h2 className="mx-auto max-w-xl font-display text-2xl leading-snug text-denim sm:text-3xl">
          {hasStock
            ? "Échale un ojo al catálogo completo, no te vas a arrepentir"
            : "El catálogo se repone cada semana — vuelve muy pronto"}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Button tone="orange" className="px-8 py-3" onClick={() => navigate("/catalogo")}>
            Ver catálogo
          </Button>
          <Button
            tone="outline"
            className="px-6 py-3 text-sm"
            onClick={() => window.open(INSTAGRAM_URL, "_blank")}
          >
            💬 Síguenos en Instagram
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Compact card for the "Lo último agregado" grid — horizontal, one-line title,
 *  cover thumb + price. Much shorter than the full catalog Card. */
const currency = (value?: number | string) =>
  typeof value === "string" || typeof value === "number"
    ? Number(value).toLocaleString("es-mx", { style: "currency", currency: "MXN" })
    : "—";

const getArtistName = (artist?: string | { name?: string } | null) => {
  if (!artist) return "Artista desconocido";
  return typeof artist === "string" ? artist : artist.name ?? "Artista desconocido";
};

function CompactRecordCard({
  record,
  priority = false
}: {
  record: RecordItem;
  priority?: boolean;
}) {
  const { original, effective, hasDiscount } = getEffectivePrice(record);
  return (
    <Link
      to={`/records/${record.slug ?? record.id}`}
      className="group flex w-full min-w-0 gap-2.5 overflow-hidden rounded-2xl border border-navy/10 bg-white/85 p-2.5 shadow-card backdrop-blur transition hover:-translate-y-0.5 hover:border-orange/40 hover:shadow-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange sm:gap-3 sm:p-3"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-navy/10 bg-sand sm:h-20 sm:w-20">
        {record.cover_image_url ? (
          <img
            src={record.cover_image_url}
            alt={record.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl">🎵</div>
        )}
        {hasDiscount ? (
          <span className="absolute top-1 right-1 rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            -{Math.round(Number(record.discount_porcentage ?? record.discount_percentage))}%
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <p className="truncate font-display text-sm leading-snug text-denim">{record.title}</p>
        <p className="truncate text-xs text-navy/70">{getArtistName(record.artist)}</p>
        <span className="mt-auto inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          {hasDiscount ? (
            <s className="text-[11px] text-navy/40">{currency(original)}</s>
          ) : null}
          <span
            className={`text-sm font-bold ${hasDiscount ? "text-orange" : "text-navy"}`}
          >
            {currency(hasDiscount ? effective : original)}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-navy/50">MXN</span>
        </span>
      </div>
    </Link>
  );
}

/** Papel picado flags — pure CSS, chilango mercado vibes. */
const FLAG_COLORS = ["#f8d15a", "#f4903c", "#e85f3c", "#e4007c", "#2e9e6b"];

function PapelPicado() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between px-4 sm:px-8"
    >
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="block h-7 w-4 origin-top opacity-90 sm:w-5"
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

/** Soft fallback so an API hiccup never blanks the storefront. */
function EmptyShelf() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-3 rounded-[24px] border border-navy/10 bg-cream/80 px-6 py-12 text-center shadow-card backdrop-blur">
      <span className="text-4xl" aria-hidden="true">💿</span>
      <p className="font-display text-lg text-denim">La vitrina se está surtiendo</p>
      <p className="max-w-md text-sm text-navy/70">
        No pudimos cargar los últimos ingresos en este momento, pero el
        catálogo completo sigue en línea.
      </p>
      <Button tone="navy" className="mt-2" onClick={() => navigate("/catalogo")}>
        Ir al catálogo
      </Button>
    </div>
  );
}

function SectionHeader({
  kicker,
  title,
  action
}: {
  kicker: string;
  title: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="space-y-0.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange">{kicker}</p>
        <h2 className="font-display text-xl text-denim sm:text-2xl">{title}</h2>
      </div>
      {action ? (
        <Link
          to={action.to}
          className="text-xs font-bold uppercase tracking-[0.12em] text-navy/60 underline decoration-orange/50 decoration-2 underline-offset-4 transition hover:text-orange"
        >
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-navy/10 bg-white/70 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-navy/80 shadow-sm">
      {children}
    </span>
  );
}

export default HomePage;
