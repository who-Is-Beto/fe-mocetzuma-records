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
