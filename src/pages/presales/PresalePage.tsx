import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { Presale, PresaleOption } from "../../app/domain/presales";
import { useServiceQuery } from "../../app/hooks";
import { useSeo } from "../../app/hooks/useSeo";
import { currency } from "../../app/lib/format";
import { HttpError } from "../../app/lib/httpClient";
import { removePresale, setPresaleLines, usePresaleBag } from "../../app/lib/presaleBag";
import { useAuth } from "../../app/providers/AuthProvider";
import { createPresaleService } from "../../app/services/presaleService";
import { Img } from "../../components/Img";
import { RelatedPicks } from "../../components/FreshPicks";
import { LostPanel } from "../../components/LostPanel";
import { Skeleton } from "../../components/Skeleton";
import { StatusPanel } from "../../components/StatusPanel";
import { primaryCta, secondaryCta } from "../../components/cta";
import {
  closingLabel,
  copiesSummary,
  daysUntil,
  piecesLabel,
  shortDate
} from "../../components/presales/presaleText";
import { SubscribeBox } from "../../components/presales/SubscribeBox";
import { ReserveForm } from "./ReserveForm";
import { VersionPicker } from "./VersionPicker";

const barButton =
  "group inline-flex min-h-[44px] items-center gap-2 rounded-pill border border-navy/15 bg-white/70 px-4 text-sm font-semibold text-navy transition hover:-translate-y-0.5 hover:border-orange hover:text-orange active:translate-y-0 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange";

const STEPS = [
  { n: "1", title: "Aparta tu copia", text: "Paga el mínimo, la mitad o lo que quieras. Si pagas completo te cuesta menos." },
  { n: "2", title: "Liquida en 120 días", text: "Desde Mis órdenes, en línea; o en la tienda en efectivo, tarjeta o transferencia." },
  { n: "3", title: "Recoge o recibe", text: "Te avisamos cuando llegue. Se entrega solo con tu código de preventa." }
];

/** /preventas/:slug — one presale: the record, its versions and the reservation. */
export function PresalePage() {
  const { slug = "" } = useParams();
  const { token } = useAuth();
  const service = useMemo(() => createPresaleService({ getToken: () => token ?? null }), [token]);
  const fetchPresale = useCallback(() => service.get(slug), [service, slug]);
  const { data: presale, isLoading, error, refetch } = useServiceQuery<Presale>([service, slug], fetchPresale);
  // Copies per version id; null until the buyer touches a stepper (until then, picks saved in the bag).
  const [picked, setPicked] = useState<Record<number, number> | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const bag = usePresaleBag();

  useSeo({
    title: presale ? `Preventa: ${presale.title} — ${presale.artist}` : "Preventa",
    description: presale
      ? `Aparta ${presale.title} de ${presale.artist} desde ${currency(
          Math.min(...presale.options.map((o) => Number(o.min_deposit)))
        )}. Preventa en Moctezuma Records.`
      : undefined,
    image: presale?.cover ?? undefined
  });

  if (isLoading && !presale) return <PresaleSkeleton />;
  if (error instanceof HttpError && error.status === 404) {
    return (
      <LostPanel
        eyebrow="Preventa"
        title="Esta preventa ya no está"
        text="Puede que ya cerró o que el enlace cambió. Mira las que siguen abiertas en el inicio."
        actions={
          <>
            <Link to="/" className={primaryCta}>Ver preventas abiertas</Link>
            <Link to="/catalogo" className={secondaryCta}>Ver catálogo</Link>
          </>
        }
      />
    );
  }
  if (error || !presale) {
    return (
      <StatusPanel
        icon="📡"
        title="No pudimos cargar la preventa"
        text="Revisa tu conexión e intenta de nuevo."
        actions={
          <button type="button" onClick={() => refetch().catch(() => undefined)} className={primaryCta}>
            Reintentar
          </button>
        }
      />
    );
  }

  const options = presale.options.filter((o) => o.is_active);
  const here = { slug: presale.slug, title: presale.title, artist: presale.artist, cover: presale.cover };
  // Other presales already in the bag go in the same order; this one's saved picks come back.
  const others = bag.filter((l) => l.presale.slug !== presale.slug);
  const saved = Object.fromEntries(bag.filter((l) => l.presale.slug === presale.slug).map((l) => [l.option.id, l.quantity]));
  // Nothing is picked on arrival: the buyer chooses (a version may be out of reach for them).
  const quantities = picked ?? saved;
  const lines = options
    .filter((o) => (quantities[o.id] ?? 0) > 0)
    .map((o) => ({ option: o, quantity: quantities[o.id], presale: here }));
  const addAnother = () => {
    setPresaleLines(here, lines);
    navigate("/#preventas");
  };
  // Pay it in the cart with records from the store: one order, one payment.
  const toCart = () => {
    setPresaleLines(here, lines);
    navigate("/carrito");
  };
  // Stats and photo follow a picked version; with none picked, the presale's own cover.
  const option: PresaleOption | null = lines.find((l) => l.option.id === focusId)?.option ?? lines[0]?.option ?? null;
  const minDeposit = options.length ? Math.min(...options.map((o) => Number(o.min_deposit))) : 0;
  const { left, total } = copiesSummary(presale);
  const closed = daysUntil(presale.purchase_deadline) < 0 || presale.status !== "published";
  const soldOut = left <= 0;
  const image = option?.image ?? presale.cover;
  // The version described under the cover: the one on screen, or the only one there is.
  const shownVersion = option ?? (options.length === 1 ? options[0] : null);

  // Opened from a shared link there's no history to go back to: land on the home page.
  const goBack = () => (location.key === "default" ? navigate("/") : navigate(-1));
  const share = async () => {
    const url = `${window.location.origin}/preventas/${presale.slug}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `${presale.title} — ${presale.artist}`, text: `Preventa de ${presale.title} en Moctezuma Records`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Closing the share sheet is not an error.
    }
  };

  return (
    <div className="space-y-16 sm:space-y-20">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={goBack} className={barButton}>
            <span aria-hidden="true" className="transition group-hover:-translate-x-0.5">←</span> Regresar
          </button>
          <button type="button" onClick={() => void share()} className={barButton} aria-live="polite">
            {copied ? (
              "Enlace copiado"
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
                </svg>
                Compartir
              </>
            )}
          </button>
        </div>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Cover: sticks beside the form on desktop, swaps with the version */}
          <div className="lg:col-span-6">
            <div className="lg:sticky lg:top-28">
              <div className="relative aspect-square overflow-hidden rounded-[26px] bg-sand shadow-panel ring-1 ring-navy/10">
                {image ? (
                  <Img
                    key={image}
                    src={image}
                    alt={`${presale.title} — ${presale.artist}${option ? ` (${option.name})` : ""}`}
                    width={640}
                    sizes="(min-width: 1024px) 46vw, 92vw"
                    priority
                    className="cover-in h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-7xl" aria-hidden="true">💿</div>
                )}
                <span className="absolute left-4 top-4 rounded-pill bg-navy px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cream">
                  Preventa
                </span>
              </div>
              {(presale.description || shownVersion?.description) && (
                <AboutRecord text={presale.description} version={shownVersion} />
              )}
            </div>
          </div>

          <div className="min-w-0 lg:col-span-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">{presale.artist}</p>
            <h1 className="mt-2 font-display text-[1.9rem] leading-[1.1] text-denim sm:text-4xl lg:text-[2.6rem]">
              {presale.title}
            </h1>

            {!closed && !soldOut && (
              <div className="mt-6">
                <VersionPicker
                  options={options}
                  quantities={quantities}
                  fallbackImage={presale.cover}
                  onChange={(o, quantity) => setPicked({ ...quantities, [o.id]: quantity })}
                  onFocus={(o) => setFocusId(o.id)}
                />
                {lines.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-x-5">
                    <button
                      type="button"
                      onClick={addAnother}
                      className="min-h-[44px] text-sm font-semibold text-denim underline decoration-orange/60 underline-offset-4 hover:text-orange"
                    >
                      + Agregar otra preventa al mismo pedido
                    </button>
                    <button
                      type="button"
                      onClick={toCart}
                      className="min-h-[44px] text-sm font-semibold text-denim underline decoration-orange/60 underline-offset-4 hover:text-orange"
                    >
                      🛒 Pagar junto con mi carrito
                    </button>
                  </div>
                )}
              </div>
            )}

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-navy/10 py-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/60">Precio</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-navy">{currency(option?.price ?? presale.price_from ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/60">Apártalo con</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-navy">{currency(option?.min_deposit ?? minDeposit)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/60">Copias</dt>
                <dd className={`mt-0.5 text-lg font-semibold ${soldOut ? "text-coral" : "text-navy"}`}>
                  {(option ? option.copies_left : left) <= 0 ? "Agotado" : `${option ? option.copies_left : left} de ${option ? option.copies : total}`}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/60">Llega</dt>
                <dd className="mt-0.5 text-lg font-semibold text-navy">{presale.estimated_arrival || "Por confirmar"}</dd>
              </div>
            </dl>

            <p className={`mt-4 text-sm font-semibold ${daysUntil(presale.purchase_deadline) <= 3 ? "text-coral" : "text-navy/75"}`}>
              {closingLabel(presale.purchase_deadline)}
              {daysUntil(presale.purchase_deadline) >= 0 ? ` · último día ${shortDate(presale.purchase_deadline)}` : ""}
            </p>

            <div className="mt-8">
              {closed || soldOut ? (
                <div className="rounded-[22px] border border-navy/10 bg-white/70 p-6">
                  <p className="font-semibold text-denim">{closed ? "Esta preventa ya cerró" : "Se apartaron todas las copias"}</p>
                  <p className="mt-1 text-sm text-navy/70">Te avisamos de la próxima preventa por correo.</p>
                  <div className="mt-4">
                    <SubscribeBox variant="compact" />
                  </div>
                </div>
              ) : (
                <>
                  {others.length > 0 && <BagSummary lines={others} />}
                  <ReserveForm presale={presale} lines={[...lines, ...others]} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <section aria-labelledby="presale-how" className="border-t border-navy/10 pt-12">
        <h2 id="presale-how" className="font-display text-2xl text-denim sm:text-3xl">Cómo funciona la preventa</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-[22px] bg-white/70 p-6 ring-1 ring-navy/10">
              <span className="font-display text-3xl text-orange" aria-hidden="true">{step.n}</span>
              <p className="mt-3 font-semibold text-denim">{step.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-navy/75">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-navy/70">
          Si no liquidas a tiempo, pierdes tu apartado.{" "}
          <Link to="/terminos-y-condiciones#preventas" className="font-semibold text-navy underline underline-offset-2 hover:text-orange">
            Lee las condiciones completas
          </Link>
          .
        </p>
      </section>

      <RelatedPicks key={presale.slug} search={presale.artist} title="Mientras llega, otros discos para ti" />
    </div>
  );
}

/**
 * The presale description under the cover: an accordion on phones (the versions
 * stay close to the top), the text itself on desktop, cut with "Leer más" when long.
 */
function AboutRecord({ text, version }: { text: string; version: PresaleOption | null }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 320;
  const versionNote = version?.description ? (
    <div key={version.id} className="cover-in mt-3 rounded-2xl bg-sun/30 px-4 py-3 ring-1 ring-sun/60">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy/70">
        {version.name} · {piecesLabel(version.items_inside)}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-navy">{version.description}</p>
    </div>
  ) : null;
  return (
    <section className="mt-4 rounded-[22px] bg-white/70 ring-1 ring-navy/10 lg:mt-5 lg:bg-transparent lg:ring-0">
      {text && <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left font-semibold text-denim focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange lg:hidden"
      >
        Sobre este disco
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>}
      <h2 className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/60 lg:block">Sobre este disco</h2>
      {text && <p
        className={`whitespace-pre-line px-4 pb-4 text-[15px] leading-relaxed text-navy/80 lg:mt-2 lg:px-0 lg:pb-0 ${
          open ? "" : "hidden lg:block"
        } ${!open && long ? "lg:max-h-[9.75rem] lg:overflow-hidden lg:[mask-image:linear-gradient(to_bottom,black_60%,transparent)]" : ""}`}
      >
        {text}
      </p>}
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 hidden min-h-[44px] text-sm font-semibold text-denim underline decoration-orange/60 underline-offset-4 hover:text-orange lg:inline"
        >
          {open ? "Leer menos" : "Leer más"}
        </button>
      )}
      {/* The version's own note is short: always visible, also with the accordion closed. */}
      {versionNote && <div className={`px-4 pb-4 lg:px-0 lg:pb-0 ${text ? "" : "pt-1"}`}>{versionNote}</div>}
    </section>
  );
}

/** Versions from other presales already in this order (one box, one payment). */
function BagSummary({ lines }: { lines: ReturnType<typeof usePresaleBag> }) {
  const presales = [...new Map(lines.map((l) => [l.presale.slug, l.presale])).values()];
  return (
    <section aria-label="También en tu pedido" className="mb-5 rounded-[22px] bg-white/70 p-4 ring-1 ring-navy/10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange">También en tu pedido</p>
      <ul className="mt-2 divide-y divide-navy/10">
        {presales.map((p) => (
          <li key={p.slug} className="flex items-center gap-3 py-2.5">
            <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-sand">
              {p.cover ? <Img src={p.cover} alt="" width={44} className="h-full w-full object-cover" /> : null}
            </span>
            <Link to={`/preventas/${p.slug}`} className="min-w-0 flex-1 hover:text-orange">
              <span className="block truncate text-sm font-semibold text-navy">{p.title}</span>
              <span className="block truncate text-xs text-navy/70">
                {lines
                  .filter((l) => l.presale.slug === p.slug)
                  .map((l) => `${l.option.name} ×${l.quantity}`)
                  .join(", ")}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => removePresale(p.slug)}
              className="min-h-[44px] shrink-0 px-2 text-xs font-semibold text-coral hover:underline"
              aria-label={`Quitar ${p.title} del pedido`}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PresaleSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12" aria-busy="true" aria-label="Cargando preventa">
      <Skeleton className="aspect-square w-full rounded-[26px] lg:col-span-6" />
      <div className="space-y-4 lg:col-span-6">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export default PresalePage;
