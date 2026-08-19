import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { T } from "../../app/i18n/strings";
import { Button } from "../../components/Button";
import { http, extractErrorMessage } from "../../app/lib/httpClient";
import { API_BASE_URL } from "../../app/config/api";
import type { Record as AlbumRecord, RecordPage } from "../../app/domain/album";
import { getEffectivePrice } from "../../app/domain/album";

const CONDITION_LABELS: { [key: string]: string } = {
  M: "Mint",
  "NM": "Near Mint",
  "NM-": "NM-",
  "VG+": "VG+",
  VG: "Very Good",
  G: "Good",
  F: "Fair",
  P: "Poor",
};

const withBase = (path: string) =>
  `${API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

type Props = {
  onEdit?: (record: AlbumRecord) => void;
};

/* ── Component ── */

export function ManageRecordsTab({ onEdit }: Props) {
  const { token } = useAuth();

  const [records, setRecords] = useState<AlbumRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [sellingRecord, setSellingRecord] = useState<AlbumRecord | null>(null);
  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState("");
  const [selling, setSelling] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellSuccess, setSellSuccess] = useState(false);

  const openSellModal = (record: AlbumRecord) => {
    setSellingRecord(record);
    setSellQty(1);
    setSellPrice(String(record.sell_price ?? record.price ?? ""));
    setSellError(null);
    setSellSuccess(false);
  };

  const confirmSell = async () => {
    if (!sellingRecord || !token) return;
    const qty = Math.max(1, Math.min(sellQty, sellingRecord.stock ?? 0));
    const newStock = (sellingRecord.stock ?? 0) - qty;
    const payload: Record<string, unknown> = { stock: newStock };
    if (sellPrice.trim()) {
      payload.final_sale_price = Number(sellPrice);
    }

    setSelling(true);
    setSellError(null);
    try {
      await http(withBase(`/records/${sellingRecord.id}/update/`), {
        method: "PATCH",
        body: payload,
        token,
      });
      setSellSuccess(true);
      setRecords((prev) =>
        prev.map((r) =>
          r.id === sellingRecord.id
            ? {
                ...r,
                stock: newStock,
                final_sale_price:
                  Number(sellPrice) || r.final_sale_price,
              }
            : r
        )
      );
      setTimeout(() => {
        setSellingRecord(null);
        setSellSuccess(false);
      }, 1500);
    } catch (err: unknown) {
      setSellError(extractErrorMessage(err, "Error al registrar la venta."));
    } finally {
      setSelling(false);
    }
  };

  const fetchRecords = useCallback(
    async (query: string, pageNum: number) => {
      if (!token) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        let data: RecordPage;

        if (query.trim()) {
          const searchUrl = new URL(withBase("/search/"));
          searchUrl.searchParams.set("query", query.trim());
          const results = await http<AlbumRecord[]>(searchUrl.toString(), {
            token,
            signal: controller.signal,
          });
          data = { count: results.length, results, next: null, previous: null };
        } else {
          const url = new URL(withBase("/records/"));
          url.searchParams.set("page", String(pageNum));
          data = await http<RecordPage>(url.toString(), {
            token,
            signal: controller.signal,
          });
        }

        if (!controller.signal.aborted) {
          setRecords(data.results ?? []);
          setTotalCount(data.count ?? 0);
          setHasNext(Boolean(data.next));
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, "Error al cargar los discos."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [token]
  );

  /* Initial fetch & re-fetch on page change */
  useEffect(() => {
    fetchRecords(search, page);
    return () => abortRef.current?.abort();
  }, [fetchRecords, page]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Debounced search */
  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchRecords(value, 1);
    }, 350);
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const formatPrice = (value: number | string | undefined) => {
    const num = Number(value) || 0;
    return num.toLocaleString("es-mx", {
      style: "currency",
      currency: "MXN",
    });
  };

  /* ── Price display with discount badge ── */
  const PriceDisplay = ({ record }: { record: AlbumRecord }) => {
    const { original, effective, discount, hasDiscount } = getEffectivePrice(record);

    if (!hasDiscount) {
      return (
        <span className="text-sm font-medium text-navy">{formatPrice(original)}</span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs text-navy/40 line-through">{formatPrice(original)}</span>
        <span className="text-sm font-bold text-orange">{formatPrice(effective)}</span>
        <span className="rounded-full bg-coral/10 px-1.5 py-0.5 text-[9px] font-bold text-coral">
          -{discount}%
        </span>
      </span>
    );
  };

  return (
    <div>
      <h2 className="font-display text-xl sm:text-2xl text-denim">
        {T.admin.manageRecords.title}
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-navy/60">
        {T.admin.manageRecords.subtitle}
      </p>

      {/* ── Search ── */}
      <div className="mt-4">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={T.admin.manageRecords.searchPlaceholder}
          className="w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <Button
            tone="outline"
            className="ml-3 px-3 py-1 text-xs"
            onClick={() => fetchRecords(search, page)}
          >
            {T.shared.retry}
          </Button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="mt-8 flex justify-center">
          <p className="text-sm text-navy/50 animate-pulse">{T.shared.loading}</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && records.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg text-navy/40">💿</p>
          <p className="mt-2 text-sm text-navy/50">
            {T.admin.manageRecords.empty}
          </p>
        </div>
      )}

      {/* ── Records table (desktop) ── */}
      {!loading && records.length > 0 && (
        <>
          <p className="mt-4 text-xs text-navy/40">
            {T.admin.manageRecords.showing
              .replace("{count}", String(records.length))
              .replace("{total}", String(totalCount))}
          </p>

          {/* Desktop table */}
          <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-navy/10 bg-white/60 backdrop-blur md:block">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-navy/10 bg-cream/60 text-[11px] uppercase tracking-wider text-navy/50">
                  <th className="px-3 py-3 font-semibold lg:px-4">
                    {T.admin.manageRecords.table.image}
                  </th>
                  <th className="px-3 py-3 font-semibold lg:px-4">
                    {T.admin.manageRecords.table.title}
                  </th>
                  <th className="hidden px-3 py-3 font-semibold lg:table-cell lg:px-4">
                    {T.admin.manageRecords.table.artist}
                  </th>
                  <th className="hidden px-3 py-3 font-semibold xl:table-cell lg:px-4">
                    {T.admin.manageRecords.table.condition}
                  </th>
                  <th className="px-3 py-3 font-semibold text-right lg:px-4">
                    {T.admin.manageRecords.table.price}
                  </th>
                  <th className="px-3 py-3 font-semibold text-right lg:px-4">
                    {T.admin.manageRecords.table.stock}
                  </th>
                  <th className="hidden px-3 py-3 font-semibold text-center xl:table-cell lg:px-4">
                    {T.admin.manageRecords.table.featured}
                  </th>
                  <th className="px-3 py-3 font-semibold text-center lg:px-4">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-navy/5 transition hover:bg-sun/10 last:border-0"
                  >
                    <td className="px-3 py-3 lg:px-4">
                      {record.cover_image_url ? (
                        <img
                          src={record.cover_image_url}
                          alt={record.title}
                          className="h-10 w-10 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/5 text-sm">
                          🎵
                        </div>
                      )}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-3 font-medium text-navy lg:max-w-[200px] lg:px-4">
                      {record.title}
                    </td>
                    <td className="hidden max-w-[160px] truncate px-3 py-3 text-navy/70 lg:table-cell lg:px-4">
                      {typeof record.artist === "object" && record.artist
                        ? record.artist.name
                        : T.shared.unknownArtist}
                    </td>
                    <td className="hidden px-3 py-3 xl:table-cell lg:px-4">
                      <span className="inline-block rounded-full bg-denim/10 px-2 py-0.5 text-[11px] font-semibold text-denim">
                        {CONDITION_LABELS[record.condition] ?? record.condition}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-navy lg:px-4">
                      <PriceDisplay record={record} />
                    </td>
                    <td className="px-3 py-3 text-right lg:px-4">
                      <span
                        className={`font-medium ${
                          (record.stock ?? 0) > 0
                            ? "text-navy"
                            : "text-coral"
                        }`}
                      >
                        {record.stock ?? 0}
                      </span>
                    </td>
                    <td className="hidden px-3 py-3 text-center xl:table-cell lg:px-4">
                      {record.featured ? (
                        <span className="inline-block rounded-full bg-sun/60 px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                          ★
                        </span>
                      ) : (
                        <span className="text-navy/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 lg:px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openSellModal(record)}
                          className="rounded-full bg-orange px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-orange/80"
                        >
                          Vender
                        </button>
                        <button
                          onClick={() => onEdit?.(record)}
                          className="rounded-full border border-navy/15 bg-white px-3 py-1 text-[11px] font-semibold text-navy transition hover:bg-navy/5"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-3 space-y-2 md:hidden">
            {records.map((record) => (
              <div
                key={record.id}
                className="flex items-center gap-3 rounded-xl border border-navy/10 bg-white/60 p-3 backdrop-blur"
              >
                {record.cover_image_url ? (
                  <img
                    src={record.cover_image_url}
                    alt={record.title}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-sm">
                    🎵
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">
                    {record.title}
                  </p>
                  <p className="truncate text-xs text-navy/60">
                    {typeof record.artist === "object" && record.artist
                      ? record.artist.name
                      : T.shared.unknownArtist}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-denim/10 px-2 py-0.5 text-[10px] font-semibold text-denim">
                      {CONDITION_LABELS[record.condition] ?? record.condition}
                    </span>
                    <PriceDisplay record={record} />
                    <span
                      className={`text-xs font-medium ${
                        (record.stock ?? 0) > 0
                          ? "text-navy"
                          : "text-coral"
                      }`}
                    >
                      ×{record.stock ?? 0}
                    </span>
                    {record.featured && (
                      <span className="rounded-full bg-sun/60 px-1.5 py-0.5 text-[10px] font-semibold text-charcoal">
                        ★
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => openSellModal(record)}
                      className="rounded-full bg-orange px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-orange/80"
                    >
                      Vender
                    </button>
                    <button
                      onClick={() => onEdit?.(record)}
                      className="rounded-full border border-navy/15 bg-white px-3 py-1 text-[11px] font-semibold text-navy transition hover:bg-navy/5"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Pagination ── */}
          <div className="mt-4 flex items-center justify-between">
            <Button
              tone="outline"
              className="px-3 py-2 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Anterior
            </Button>
            <span className="text-xs text-navy/50">
              {T.admin.manageRecords.page
                .replace("{page}", String(page))}
            </span>
            <Button
              tone="outline"
              className="px-3 py-2 text-xs"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente →
            </Button>
          </div>
        </>
      )}

      {/* ── Sell modal overlay ── */}
      {sellingRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-overlay-in"
          onClick={() => !selling && setSellingRecord(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-navy/10 bg-sand p-5 shadow-panel animate-modal-in sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg text-denim">Registrar venta</h3>
            <p className="mt-1 text-sm text-navy/60">
              {sellingRecord.title}
              {typeof sellingRecord.artist === "object" &&
                sellingRecord.artist &&
                ` — ${sellingRecord.artist.name}`}
            </p>

            {sellSuccess ? (
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                Venta registrada correctamente
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-navy/60">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={sellingRecord.stock ?? 0}
                      value={sellQty}
                      onChange={(e) =>
                        setSellQty(
                          Math.max(
                            1,
                            Math.min(
                              Number(e.target.value) || 1,
                              sellingRecord.stock ?? 0
                            )
                          )
                        )
                      }
                      className="w-full rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
                    />
                    <p className="mt-1 text-[11px] text-navy/40">
                      Stock disponible: {sellingRecord.stock ?? 0}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-navy/60">
                      Precio de venta final (MXN)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      className="w-full rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
                    />
                  </div>
                </div>

                {sellError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    {sellError}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setSellingRecord(null)}
                    className="rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy transition hover:bg-navy/5"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmSell}
                    disabled={selling}
                    className="rounded-pill bg-orange px-5 py-2 text-xs font-semibold text-white shadow-panel transition hover:bg-orange/80 disabled:opacity-50"
                  >
                    {selling ? "Procesando..." : "Confirmar venta"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
