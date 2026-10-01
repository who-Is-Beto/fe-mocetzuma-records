import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { T } from "../../app/i18n/strings";
import { Button } from "../../components/Button";
import { Toast } from "../../components/Toast";
import { Img } from "../../components/Img";
import { extractErrorMessage } from "../../app/lib/httpClient";
import type { Record as AlbumRecord, RecordOwnerStock } from "../../app/domain/album";
import { getEffectivePrice } from "../../app/domain/album";
import { currency } from "../../app/lib/format";
import { useAdminRecords } from "../../app/hooks/useAdminRecords";
import {
  DEFAULT_CARD_COMMISSION_RATE,
  PAYMENT_METHOD_LABELS,
  commissionCents,
  toCents,
  type PaymentMethod,
  type Sale,
} from "../../app/domain/sales";
import { ReceiptPrinter } from "./sales/SaleReceipt";
import type { EditReturn } from "./AdminPage";

/* Pills show the grading code (NM, VG+…); the full name is the tooltip. */
const CONDITION_LABELS: { [key: string]: string } = {
  M: "Mint",
  "NM": "Near Mint",
  "NM-": "Near Mint -",
  "VG+": "Very Good +",
  VG: "Very Good",
  G: "Good",
  F: "Fair",
  P: "Poor",
};

type Props = {
  onEdit?: (record: AlbumRecord) => void;
  /** Set right after the record editor closes: refresh, restore scroll, highlight. */
  editReturn?: EditReturn | null;
  onReturnHandled?: () => void;
};

/** A line of the sale ticket; `price` is the raw input value (unit, MXN).
 * `owners` are the ones with stock (null while loading). With several owners
 * `split` says how many units of each are sold and `quantity` is their sum. */
type TicketLine = {
  record: AlbumRecord;
  quantity: number;
  price: string;
  owners: RecordOwnerStock[] | null;
  split: { [ownerId: string]: number };
};

const isSplit = (line: TicketLine) => (line.owners?.length ?? 0) > 1;

const PAYMENT_OPTIONS: { method: PaymentMethod; icon: string }[] = [
  { method: "cash", icon: "💵" },
  { method: "card", icon: "💳" },
  { method: "transfer", icon: "🏦" },
];

/** 0–100 with at most two decimals, like the backend's commission_rate field. */
const isValidRate = (rate: string) =>
  /^\d{1,3}(\.\d{1,2})?$/.test(rate.trim()) && Number(rate) <= 100;

/* ── Component ── */

export function ManageRecordsTab({ onEdit, editReturn, onReturnHandled }: Props) {
  const { token, hasPerm } = useAuth();
  const canEdit = hasPerm("apiApp.change_record");
  const canDelete = hasPerm("apiApp.delete_record");
  const { records, totalCount, hasNext, loading, error, loadPage, sell, loadForEdit, remove } =
    useAdminRecords({ token });

  // ?q= and ?page= live in the URL (AdminPage owns ?tab/?edit), so a reload,
  // Back, or closing the editor lands on the same search and page.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [search, setSearch] = useState(urlQuery);
  // Back/Forward changed ?q=: mirror it in the box (render-time sync, no effect).
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (urlQuery !== search.trim()) setSearch(urlQuery);
  }
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightId, setHighlightId] = useState<AlbumRecord["id"] | null>(null);

  const setListParams = useCallback(
    (q: string, pageNum: number) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q.trim()) next.set("q", q.trim());
          else next.delete("q");
          if (pageNum > 1) next.set("page", String(pageNum));
          else next.delete("page");
          return next;
        },
        { replace: true }
      ),
    [setSearchParams]
  );
  const setPage = (update: (p: number) => number) => {
    setListParams(urlQuery, update(page));
    window.scrollTo({ top: 0 });
  };

  /* ── Sale ticket: "Vender" adds a record; several records → one sale ── */
  const [ticket, setTicket] = useState<TicketLine[]>([]);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [selling, setSelling] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  // The registered sale: the modal shows the success state + "Imprimir ticket".
  const [soldSale, setSoldSale] = useState<Sale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [commissionRate, setCommissionRate] = useState(DEFAULT_CARD_COMMISSION_RATE);
  const [printing, setPrinting] = useState<Sale | null>(null);
  const stopPrinting = useCallback(() => setPrinting(null), []);
  const [toast, setToast] = useState<{ tone: "warning" | "error"; message: string } | null>(null);

  /* ── Permanent delete ── */
  const [deleteTarget, setDeleteTarget] = useState<AlbumRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Row/card currently playing the vanish animation (already deleted server-side).
  const [vanishing, setVanishing] = useState<{
    id: string | number;
    record: AlbumRecord;
    index: number;
  } | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const idx = records.findIndex((r) => r.id === target.id);
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(target.id);
      setDeleteTarget(null);
      // The hook already dropped the row; re-insert it temporarily so it can
      // play the vanish animation, then drop it for good.
      setVanishing({ id: target.id, record: target, index: Math.max(0, idx) });
      setTimeout(() => setVanishing(null), 520);
    } catch (err: unknown) {
      setDeleteError(extractErrorMessage(err, "Error al eliminar el disco."));
    } finally {
      setDeleting(false);
    }
  };

  const addToTicket = (record: AlbumRecord) => {
    if (ticket.some((l) => l.record.id === record.id)) {
      setTicketOpen(true);
      return;
    }
    setTicket((prev) => [
      ...prev,
      { record, quantity: 1, price: String(record.sell_price || record.price || ""), owners: null, split: {} },
    ]);
    setSellError(null);
    setTicketOpen(true);
    // List rows don't carry owners (admin-only field): load whose units it has.
    loadForEdit(record.id)
      .then((full) => {
        const owners = (full.owners ?? []).filter((o) => o.quantity > 0);
        // Several owners: nothing picked yet, the admin says how many of whose.
        updateLine(record.id, owners.length > 1 ? { owners, quantity: 0 } : { owners });
      })
      .catch(() => updateLine(record.id, { owners: [] }));
  };

  const updateLine = (id: AlbumRecord["id"], changes: Partial<TicketLine>) =>
    setTicket((prev) => prev.map((l) => (l.record.id === id ? { ...l, ...changes } : l)));

  // An empty price means the record's current price (the backend's default too).
  const unitPrice = (line: TicketLine) =>
    Number(line.price.trim() || line.record.sell_price || line.record.price) || 0;
  // Integer cents, so the preview matches the backend's Decimal math exactly.
  const subtotalCents = ticket.reduce((sum, l) => sum + toCents(unitPrice(l)) * l.quantity, 0);
  const rateValid = isValidRate(commissionRate);
  const feeCents =
    paymentMethod === "card" && rateValid ? commissionCents(subtotalCents, commissionRate) : 0;
  const canConfirm =
    paymentMethod !== null &&
    (paymentMethod !== "card" || rateValid) &&
    ticket.every((l) => l.owners !== null && l.quantity > 0);

  /** Clears the ticket for the next sale (after it was registered or discarded). */
  const resetTicket = () => {
    setTicket([]);
    setTicketOpen(false);
    setSoldSale(null);
    setPaymentMethod(null);
    setCommissionRate(DEFAULT_CARD_COMMISSION_RATE);
  };

  const closeTicket = () => {
    if (selling) return;
    if (soldSale) resetTicket();
    else setTicketOpen(false);
  };

  const confirmSell = async () => {
    if (!paymentMethod || !canConfirm) return;
    setSelling(true);
    setSellError(null);
    try {
      const { sale, warnings } = await sell(
        // A split line goes out as one sale line per owner.
        ticket.flatMap((l) => {
          const price = l.price.trim() || undefined;
          if (!isSplit(l)) return [{ record: l.record, quantity: l.quantity, price }];
          return Object.entries(l.split)
            .filter(([, quantity]) => quantity > 0)
            .map(([owner, quantity]) => ({ record: l.record, quantity, price, owner: Number(owner) }));
        }),
        {
          payment_method: paymentMethod,
          commission_rate: paymentMethod === "card" ? commissionRate.trim() : undefined,
        }
      );
      setSoldSale(sale);
      // No owner / failed email never undo the sale: warn without blocking.
      if (warnings.length > 0) {
        setToast({ tone: "warning", message: `Venta registrada. ${warnings.join(" ")}` });
      }
    } catch (err: unknown) {
      setSellError(extractErrorMessage(err, "Error al registrar la venta."));
    } finally {
      setSelling(false);
    }
  };

  /* ── Editar: list rows lack description/weight/etc., so edit the full record ── */
  const openEditor = async (record: AlbumRecord) => {
    try {
      onEdit?.(await loadForEdit(record.id));
    } catch (err: unknown) {
      setToast({
        tone: "error",
        message: extractErrorMessage(err, "No se pudo abrir el disco para editar."),
      });
    }
  };

  /* ── Load whenever the URL's search/page change (mount, paging, Back) ── */
  useEffect(() => {
    void loadPage(urlQuery, page);
  }, [loadPage, urlQuery, page]);

  /* ── Back from the editor: refetch (edits may change the row), then put the
   *    admin where they were and flash the edited record ── */
  useEffect(() => {
    if (!editReturn) return;
    let cancelled = false;
    void loadPage(urlQuery, page).then(() => {
      if (cancelled) return;
      onReturnHandled?.();
      setHighlightId(editReturn.recordId);
      // Wait for the refreshed rows to paint before measuring.
      requestAnimationFrame(() => {
        window.scrollTo({ top: editReturn.scrollY });
        const row = Array.from(
          document.querySelectorAll<HTMLElement>(`[data-record-id="${editReturn.recordId}"]`)
        ).find((el) => el.offsetParent !== null); // the visible one (table or card)
        const rect = row?.getBoundingClientRect();
        if (row && rect && (rect.top < 0 || rect.bottom > window.innerHeight)) {
          row.scrollIntoView({ block: "center" });
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [editReturn]); // eslint-disable-line react-hooks/exhaustive-deps -- runs once per return

  useEffect(() => {
    if (highlightId === null) return;
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
  }, [highlightId]);

  /* ── Debounced search (URL update triggers the load) ── */
  const onSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setListParams(value, 1), 350);
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  /* ── Rows to render (keeps the vanishing row visible mid-animation) ── */
  const displayRecords = useMemo(() => {
    if (!vanishing) return records;
    const { id, record, index } = vanishing;
    if (records.some((r) => r.id === id)) return records;
    const list = [...records];
    list.splice(Math.min(index, list.length), 0, record);
    return list;
  }, [records, vanishing]);

  const isVanishing = (id: string | number): boolean => vanishing?.id === id;

  /* ── Price display with discount badge ── */
  const PriceDisplay = ({ record, stacked = false }: { record: AlbumRecord; stacked?: boolean }) => {
    const { original, effective, discount, hasDiscount } = getEffectivePrice(record);

    if (!hasDiscount) {
      return (
        <span className="whitespace-nowrap text-sm font-medium text-navy">{currency(original)}</span>
      );
    }

    if (stacked) {
      return (
        <span className="inline-flex flex-col items-end whitespace-nowrap leading-tight">
          <span className="inline-flex items-center gap-1">
            <span className="text-[11px] text-navy/40 line-through">{currency(original)}</span>
            <span className="rounded-full bg-coral/10 px-1.5 py-0.5 text-[9px] font-bold text-coral">
              -{discount}%
            </span>
          </span>
          <span className="text-sm font-bold text-orange">{currency(effective)}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs text-navy/40 line-through">{currency(original)}</span>
        <span className="text-sm font-bold text-orange">{currency(effective)}</span>
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

      {/* ── Sale in progress (ticket closed to add more records) ── */}
      {!ticketOpen && ticket.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange/40 bg-orange/10 px-4 py-2.5">
          <span className="text-sm font-semibold text-navy">
            🧾 Venta en curso: {ticket.length} {ticket.length === 1 ? "disco" : "discos"} ·{" "}
            {currency(subtotalCents / 100)}
          </span>
          <button
            onClick={() => setTicketOpen(true)}
            className="rounded-pill bg-orange px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-orange/80"
          >
            Continuar venta
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <Button
            tone="outline"
            className="ml-3 px-3 py-1 text-xs"
            onClick={() => void loadPage(urlQuery, page)}
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
      {!loading && !error && displayRecords.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg text-navy/40">💿</p>
          <p className="mt-2 text-sm text-navy/50">
            {T.admin.manageRecords.empty}
          </p>
        </div>
      )}

      {/* ── Records table (desktop) ── */}
      {!loading && displayRecords.length > 0 && (
        <>
          <p className="mt-4 text-xs text-navy/40">
            {T.admin.manageRecords.showing
              .replace("{count}", String(displayRecords.length))
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
                    {T.admin.manageRecords.table.title} / {T.admin.manageRecords.table.artist}
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
                {displayRecords.map((record) => (
                  <tr
                    key={record.id}
                    data-record-id={record.id}
                    className={`border-b border-navy/5 transition hover:bg-sun/10 last:border-0 ${
                      highlightId === record.id ? "bg-sun/30" : ""
                    } ${
                      isVanishing(record.id)
                        ? "animate-record-out pointer-events-none [&>td]:border-transparent [&>td]:!py-0 [&>td]:transition-all [&>td]:duration-500"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-3 lg:px-4">
                      {record.cover_image_url ? (
                        <Img
                          src={record.cover_image_url}
                          alt={record.title}
                          width={40}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/5 text-sm">
                          🎵
                        </div>
                      )}
                    </td>
                    <td className="max-w-[180px] px-3 py-3 lg:max-w-[260px] lg:px-4">
                      <p className="truncate font-medium text-navy" title={record.title}>
                        {record.title}
                      </p>
                      <p className="truncate text-xs text-navy/60">
                        {typeof record.artist === "object" && record.artist
                          ? record.artist.name
                          : T.shared.unknownArtist}
                      </p>
                    </td>
                    <td className="hidden px-3 py-3 xl:table-cell lg:px-4">
                      <span
                        title={CONDITION_LABELS[record.condition]}
                        className="inline-block whitespace-nowrap rounded-full bg-denim/10 px-2 py-0.5 text-[11px] font-semibold text-denim"
                      >
                        {record.condition}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-navy lg:px-4">
                      <PriceDisplay record={record} stacked />
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
                      <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => addToTicket(record)}
                              disabled={(record.stock ?? 0) <= 0}
                              className="rounded-full bg-orange px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-orange/80 disabled:opacity-40"
                            >
                              Vender
                            </button>
                            <button
                              onClick={() => void openEditor(record)}
                              className="rounded-full border border-navy/15 bg-white px-3 py-1 text-[11px] font-semibold text-navy transition hover:bg-navy/5"
                            >
                              Editar
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => {
                              setDeleteTarget(record);
                              setDeleteError(null);
                            }}
                            disabled={isVanishing(record.id)}
                            title="Eliminar permanentemente"
                            aria-label="Eliminar permanentemente"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-coral transition hover:bg-coral/10 hover:text-coral/80 disabled:opacity-50"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-3 space-y-2 md:hidden">
            {displayRecords.map((record) => (
              <div
                key={record.id}
                data-record-id={record.id}
                className={`flex items-center gap-3 rounded-xl border p-3 backdrop-blur transition-colors ${
                  highlightId === record.id ? "border-orange bg-sun/30" : "border-navy/10 bg-white/60"
                } ${
                  isVanishing(record.id)
                    ? "animate-record-out pointer-events-none"
                    : ""
                }`}
              >
                {record.cover_image_url ? (
                  <Img
                    src={record.cover_image_url}
                    alt={record.title}
                    width={48}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
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
                    <span
                      title={CONDITION_LABELS[record.condition]}
                      className="whitespace-nowrap rounded-full bg-denim/10 px-2 py-0.5 text-[10px] font-semibold text-denim"
                    >
                      {record.condition}
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
                    {canEdit && (
                      <>
                        <button
                          onClick={() => addToTicket(record)}
                          disabled={(record.stock ?? 0) <= 0}
                          className="rounded-full bg-orange px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-orange/80 disabled:opacity-40"
                        >
                          Vender
                        </button>
                        <button
                          onClick={() => void openEditor(record)}
                          className="rounded-full border border-navy/15 bg-white px-3 py-1 text-[11px] font-semibold text-navy transition hover:bg-navy/5"
                        >
                          Editar
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => {
                          setDeleteTarget(record);
                          setDeleteError(null);
                        }}
                        disabled={isVanishing(record.id)}
                        title="Eliminar permanentemente"
                        aria-label="Eliminar permanentemente"
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-coral transition hover:bg-coral/10 hover:text-coral/80 disabled:opacity-50"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    )}
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

      {/* ── Sale ticket modal: one or more records, one sale ── */}
      {ticketOpen && ticket.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-overlay-in"
          onClick={closeTicket}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-navy/10 bg-sand p-5 shadow-panel animate-modal-in sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg text-denim">Registrar venta</h3>
            <p className="mt-1 text-xs text-navy/60">
              Para vender varios discos juntos usa «Agregar otro disco». Cada
              dueño recibe un correo solo con sus discos.
            </p>

            {soldSale ? (
              <>
                <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  Venta #{soldSale.id} registrada correctamente · Total final{" "}
                  <span className="font-semibold">{currency(soldSale.final_sale_price)}</span>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                  <button
                    onClick={resetTicket}
                    className="rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy transition hover:bg-navy/5"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => setPrinting(soldSale)}
                    className="rounded-pill bg-orange px-5 py-2 text-xs font-semibold text-charcoal shadow-panel transition hover:bg-amber"
                  >
                    🖨 Imprimir ticket
                  </button>
                </div>
              </>
            ) : (
              <>
                <ul className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto">
                  {ticket.map((line) => (
                    <li
                      key={line.record.id}
                      className="rounded-xl border border-navy/10 bg-white/70 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-semibold text-navy">
                          {line.record.title}
                          {typeof line.record.artist === "object" &&
                            line.record.artist &&
                            ` — ${line.record.artist.name}`}
                        </p>
                        <button
                          onClick={() =>
                            setTicket((prev) => prev.filter((l) => l.record.id !== line.record.id))
                          }
                          disabled={selling}
                          aria-label={`Quitar ${line.record.title} de la venta`}
                          className="shrink-0 rounded-full px-2 text-sm text-coral transition hover:bg-coral/10 disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        {isSplit(line) ? (
                          <p className="text-[11px] font-semibold text-navy/60">
                            Cantidad
                            <span className="mt-1 block px-1 py-2 text-sm text-navy">
                              {line.quantity} (stock: {line.record.stock ?? 0})
                            </span>
                          </p>
                        ) : (
                          <label className="block text-[11px] font-semibold text-navy/60">
                            Cantidad (stock: {line.record.stock ?? 0})
                            <input
                              type="number"
                              min={1}
                              max={line.record.stock ?? 0}
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.record.id, {
                                  quantity: Math.max(
                                    1,
                                    Math.min(Number(e.target.value) || 1, line.record.stock ?? 0)
                                  ),
                                })
                              }
                              className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
                            />
                          </label>
                        )}
                        <label className="block text-[11px] font-semibold text-navy/60">
                          Precio unitario (MXN)
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.price}
                            onChange={(e) => updateLine(line.record.id, { price: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
                          />
                        </label>
                      </div>
                      {line.owners === null && (
                        <p className="mt-2 text-[11px] text-navy/50 animate-pulse">Cargando dueños…</p>
                      )}
                      {/* Several owners have it: how many of whose, like the record form */}
                      {line.owners && isSplit(line) && (
                        <fieldset className="mt-2">
                          <legend className="text-[11px] font-semibold text-navy/60">
                            ¿De quién son los que vendes? <span className="text-coral">*</span>
                          </legend>
                          <ul className="mt-1 space-y-1.5">
                            {line.owners.map((o) => (
                              <li key={o.owner} className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 truncate text-sm text-navy">
                                  {o.owner_name}{" "}
                                  <span className="text-[11px] text-navy/50">({o.quantity} en stock)</span>
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={o.quantity}
                                  value={line.split[o.owner] ?? 0}
                                  aria-label={`Cantidad de ${o.owner_name}`}
                                  disabled={selling}
                                  onChange={(e) => {
                                    const split: TicketLine["split"] = {
                                      ...line.split,
                                      [o.owner]: Math.max(0, Math.min(Number(e.target.value) || 0, o.quantity)),
                                    };
                                    const quantity = Object.values(split).reduce((sum, n) => sum + n, 0);
                                    updateLine(line.record.id, { split, quantity });
                                  }}
                                  className="w-20 rounded-xl border border-navy/15 bg-white px-3 py-1.5 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
                                />
                              </li>
                            ))}
                          </ul>
                          {line.quantity === 0 && (
                            <p className="mt-1 text-[11px] font-semibold text-coral">
                              Indica cuántos vendes de cada dueño.
                            </p>
                          )}
                        </fieldset>
                      )}
                      {line.owners?.length === 1 && (
                        <p className="mt-2 text-[11px] text-navy/50">Dueño: {line.owners[0].owner_name}</p>
                      )}
                    </li>
                  ))}
                </ul>

                {/* ── Payment method (required) + card commission ── */}
                <fieldset className="mt-4">
                  <legend className="text-[11px] font-semibold text-navy/60">
                    Forma de pago <span className="text-coral">*</span>
                  </legend>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {PAYMENT_OPTIONS.map(({ method, icon }) => (
                      <label
                        key={method}
                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-navy/15 bg-white px-2 py-2.5 text-xs font-semibold text-navy transition hover:border-orange has-[:checked]:border-orange has-[:checked]:bg-orange has-[:checked]:text-charcoal has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange/30 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
                      >
                        <input
                          type="radio"
                          name="payment_method"
                          value={method}
                          checked={paymentMethod === method}
                          onChange={() => setPaymentMethod(method)}
                          disabled={selling}
                          className="sr-only"
                        />
                        <span aria-hidden="true">{icon}</span>
                        {PAYMENT_METHOD_LABELS[method]}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {paymentMethod === "card" && (
                  <label className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold text-navy/60">
                    Comisión por tarjeta (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      inputMode="decimal"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      disabled={selling}
                      aria-invalid={!rateValid}
                      className={`w-24 rounded-xl border bg-white px-3 py-2 text-right text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30 ${
                        rateValid ? "border-navy/15" : "border-coral"
                      }`}
                    />
                  </label>
                )}
                {paymentMethod === "card" && !rateValid && (
                  <p className="mt-1 text-right text-[11px] text-coral">
                    Usa un porcentaje entre 0 y 100 (máx. 2 decimales).
                  </p>
                )}

                <dl className="mt-4 space-y-1 rounded-xl border border-navy/10 bg-white/70 px-4 py-3 text-sm text-navy">
                  <div className="flex justify-between">
                    <dt className="text-navy/60">Subtotal</dt>
                    <dd>{currency(subtotalCents / 100)}</dd>
                  </div>
                  {paymentMethod === "card" && (
                    <div className="flex justify-between">
                      <dt className="text-navy/60">
                        Comisión tarjeta ({rateValid ? Number(commissionRate) : "—"}%)
                      </dt>
                      <dd className="text-coral">−{currency(feeCents / 100)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-navy/10 pt-1.5 font-semibold">
                    <dt>Total final</dt>
                    <dd className="text-lg text-denim">{currency((subtotalCents - feeCents) / 100)}</dd>
                  </div>
                </dl>

                {sellError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    {sellError}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                  <button
                    onClick={resetTicket}
                    disabled={selling}
                    className="rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy transition hover:bg-navy/5 disabled:opacity-50"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={() => setTicketOpen(false)}
                    disabled={selling}
                    className="rounded-full border border-orange/40 bg-white px-4 py-2 text-xs font-semibold text-orange transition hover:bg-orange/10 disabled:opacity-50"
                  >
                    + Agregar otro disco
                  </button>
                  <button
                    onClick={confirmSell}
                    disabled={selling || !canConfirm}
                    title={paymentMethod ? undefined : "Elige la forma de pago"}
                    className="rounded-pill bg-orange px-5 py-2 text-xs font-semibold text-white shadow-panel transition hover:bg-orange/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {selling ? "Procesando..." : "Confirmar venta"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-overlay-in"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-navy/10 bg-sand p-5 shadow-panel animate-modal-in sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-coral/15 text-xl">
                🗑️
              </div>
              <div>
                <h3 className="font-display text-lg text-denim">
                  ¿Eliminar este disco?
                </h3>
                <p className="mt-1 text-sm font-semibold text-navy">
                  {deleteTarget.title}
                  {typeof deleteTarget.artist === "object" &&
                    deleteTarget.artist &&
                    ` — ${deleteTarget.artist.name}`}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-xs leading-relaxed text-navy/80">
              Esta acción es <strong>permanente</strong>: el disco desaparecerá
              de la tienda junto con sus reseñas. Las órdenes pasadas conservan
              su historial.
            </div>

            {deleteError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy transition hover:bg-navy/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-pill bg-coral px-5 py-2 text-xs font-semibold text-white shadow-panel transition hover:bg-coral/80 disabled:opacity-50"
              >
                {deleting ? "Eliminando…" : "Sí, eliminar para siempre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {printing && <ReceiptPrinter sale={printing} onDone={stopPrinting} />}

      {/* ── Non-blocking notices: sale saved without an owner email, edit load failed ── */}
      {toast && (
        <Toast
          tone={toast.tone}
          message={toast.message}
          duration={10000}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}