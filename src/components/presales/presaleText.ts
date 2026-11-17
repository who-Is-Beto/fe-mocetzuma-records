import type { Presale, PresaleOption } from "../../app/domain/presales";

const DAY = 24 * 60 * 60 * 1000;

/** Whole store days from today until an ISO date (negative once it passed). */
export const daysUntil = (isoDate: string): number => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / DAY);
};

/** "12 de diciembre" (no year when it's this year). */
export const shortDate = (isoDate: string): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    ...(y !== new Date().getFullYear() ? { year: "numeric" as const } : {})
  });
};

/** "Cierra hoy" / "Cierra mañana" / "Cierra en 5 días" / "Cerrada". */
export const closingLabel = (deadline: string): string => {
  const days = daysUntil(deadline);
  if (days < 0) return "Preventa cerrada";
  if (days === 0) return "Cierra hoy";
  if (days === 1) return "Cierra mañana";
  if (days <= 14) return `Cierra en ${days} días`;
  return `Aparta hasta el ${shortDate(deadline)}`;
};

/**
 * What the public lists show: presales still before their deadline, open ones
 * first, then the soonest to close (sold-out ones stay until their date).
 */
export const visiblePresales = (presales: Presale[]): Presale[] =>
  presales
    .filter((p) => daysUntil(p.purchase_deadline) >= 0)
    .sort(
      (a, b) =>
        Number(b.is_open) - Number(a.is_open) || a.purchase_deadline.localeCompare(b.purchase_deadline)
    );

export const activeOptions = (presale: Presale): PresaleOption[] => presale.options.filter((o) => o.is_active);

export const copiesSummary = (presale: Presale) => {
  const options = activeOptions(presale);
  const total = options.reduce((sum, o) => sum + o.copies, 0);
  const left = options.reduce((sum, o) => sum + Math.max(o.copies_left, 0), 0);
  return { total, left };
};

export const minDeposit = (presale: Presale): number =>
  Math.min(...activeOptions(presale).map((o) => Number(o.min_deposit)));

/** "Quedan 4 de 20" / "Última copia" / "Agotado". */
export const copiesLabel = (left: number, total: number): string => {
  if (left <= 0) return "Agotado";
  if (left === 1) return "Última copia";
  return `Quedan ${left} de ${total}`;
};

/** "1 pieza" / "3 piezas": what comes in one copy of a version. */
export const piecesLabel = (n: number): string => `${n || 1} ${(n || 1) === 1 ? "pieza" : "piezas"}`;

const fold = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Presales whose title or artist matches a search ("miles" finds Miles Davis), open ones first. */
export const matchPresales = (presales: Presale[], query: string): Presale[] => {
  const q = fold(query);
  if (q.length < 2) return [];
  return presales
    .filter((p) => daysUntil(p.purchase_deadline) >= 0)
    .filter((p) => {
      const title = fold(p.title);
      const artist = fold(p.artist);
      return title.includes(q) || artist.includes(q) || (artist.length > 2 && q.includes(artist)) || (title.length > 2 && q.includes(title));
    })
    .sort((a, b) => Number(b.is_open) - Number(a.is_open));
};

// What a buyer agrees to before paying a presale. Paying in full there's nothing
// left to settle: what they agree to is the arrival.
export const ARRIVAL_TEXT =
  "Entiendo que la fecha de llegada es estimada y que las copias pueden llegar a la tienda en varios envíos. Me avisan en cuanto llegue la mía.";
export const DEPOSIT_TEXT =
  "Acepto que tengo 120 días desde hoy para liquidar mi preventa; si no, pierdo mi apartado. La fecha de llegada es estimada.";
