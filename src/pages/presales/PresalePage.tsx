import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Presale, PresaleOption } from "../../app/domain/presales";
import { useServiceQuery } from "../../app/hooks";
import { useSeo } from "../../app/hooks/useSeo";
import { currency } from "../../app/lib/format";
import { HttpError } from "../../app/lib/httpClient";
import { useAuth } from "../../app/providers/AuthProvider";
import { createPresaleService } from "../../app/services/presaleService";
import { Img } from "../../components/Img";
import { LostPanel } from "../../components/LostPanel";
import { Skeleton } from "../../components/Skeleton";
import { StatusPanel } from "../../components/StatusPanel";
import { primaryCta, secondaryCta } from "../../components/cta";
import {
  closingLabel,
  copiesSummary,
  daysUntil,
  shortDate
} from "../../components/presales/presaleText";
import { SubscribeBox } from "../../components/presales/SubscribeBox";
import { ReserveForm } from "./ReserveForm";

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
  const [pickedId, setPickedId] = useState<number | null>(null);

  useSeo({
    title: presale ? `Preventa: ${presale.title} — ${presale.artist}` : "Preventa",
    description: presale
      ? `Aparta ${presale.title} de ${presale.artist} desde ${currency(
          Math.min(...presale.options.map((o) => Number(o.min_deposit)))
        )}. Preventa en Moctezuma Records.`
      : undefined
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
  const firstAvailable = options.find((o) => o.copies_left > 0) ?? null;
  const option: PresaleOption | null =
    options.find((o) => o.id === pickedId) ?? (options.length === 1 ? options[0] : firstAvailable);
  const { left, total } = copiesSummary(presale);
  const closed = daysUntil(presale.purchase_deadline) < 0 || presale.status !== "published";
  const soldOut = left <= 0;
  const image = option?.image ?? presale.cover;

  return (
    <div className="space-y-16 sm:space-y-20">
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
          </div>
        </div>

        <div className="min-w-0 lg:col-span-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">{presale.artist}</p>
          <h1 className="mt-2 font-display text-[1.9rem] leading-[1.1] text-denim sm:text-4xl lg:text-[2.6rem]">
            {presale.title}
          </h1>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-navy/10 py-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/60">Precio</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-navy">{currency(option?.price ?? presale.price_from ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/60">Apártalo con</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-navy">{currency(option?.min_deposit ?? 0)}</dd>
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

          {presale.description && (
            <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-navy/80">{presale.description}</p>
          )}

          <div className="mt-8">
            {closed || soldOut ? (
              <div className="rounded-[22px] border border-navy/10 bg-white/70 p-6">
                <p className="font-semibold text-denim">{closed ? "Esta preventa ya cerró" : "Se apartaron todas las copias"}</p>
                <p className="mt-1 text-sm text-navy/70">Te avisamos de la próxima preventa por correo.</p>
                <div className="mt-4">
                  <SubscribeBox compact />
                </div>
              </div>
            ) : (
              <ReserveForm presale={presale} option={option} onPickOption={(o) => setPickedId(o.id)} />
            )}
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
    </div>
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
