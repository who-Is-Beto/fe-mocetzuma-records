import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Img } from "./Img";
import { Skeleton } from "./Skeleton";
import type { Record } from "../app/domain/album";
import { getEffectivePrice } from "../app/domain/album";
import { currency } from "../app/lib/format";
import { useAuth } from "../app/providers/AuthProvider";
import { createRecordService } from "../app/services/recordService";

const COUNT = 4;

/**
 * "Mientras tanto, lo más nuevo": the 4 newest in-stock records as compact
 * tiles, so a dead end (no results, unknown page, record gone) still leads
 * somewhere. Renders nothing if the catalog is empty or can't load.
 */
export function FreshPicks({ title = "Mientras tanto, lo más nuevo" }: { title?: string }) {
  const { token } = useAuth();
  const service = useMemo(() => createRecordService({ getToken: () => token ?? null }), [token]);
  const [records, setRecords] = useState<Record[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    service
      .list({ page_size: COUNT, available: true, ordering: "newest", signal: controller.signal })
      .then((page) => setRecords(page.results.slice(0, COUNT)))
      .catch(() => !controller.signal.aborted && setRecords([]));
    return () => controller.abort();
  }, [service]);

  if (records !== null && records.length === 0) return null;

  return (
    <section aria-label={title} className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-xl text-denim sm:text-2xl">{title}</h2>
        <Link to="/catalogo" className="shrink-0 text-sm font-semibold text-denim underline decoration-orange/60 underline-offset-4 hover:text-orange">
          Ver todo
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {records === null
          ? Array.from({ length: COUNT }, (_, i) => (
              <li key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-2xl" />
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </li>
            ))
          : records.map((record, index) => (
              <li key={record.id} className="reveal" style={{ "--i": index } as CSSProperties}>
                <Link
                  to={`/records/${record.slug ?? record.id}`}
                  className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange"
                >
                  <span className="block overflow-hidden rounded-2xl bg-navy/5 shadow-card ring-1 ring-navy/10">
                    {record.cover_image_url ? (
                      <Img
                        src={record.cover_image_url}
                        thumbs={record.cover_thumbs}
                        alt=""
                        width={240}
                        sizes="(min-width: 640px) 240px, 45vw"
                        className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <span aria-hidden="true" className="flex aspect-square w-full items-center justify-center text-3xl">🎵</span>
                    )}
                  </span>
                  <span className="mt-2 block truncate text-sm font-semibold text-navy group-hover:text-orange">{record.title}</span>
                  <span className="block truncate text-xs text-navy/65">{record.artist?.name ?? "Artista desconocido"}</span>
                  <span className="mt-0.5 block text-sm font-bold tabular-nums text-navy">{currency(getEffectivePrice(record).effective)}</span>
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
