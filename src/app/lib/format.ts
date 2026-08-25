/**
 * Shared display formatters (dates & money).
 *
 * The backend speaks snake_case ISO strings; these helpers turn them into
 * es-MX human text. Every formatter is defensive: unparsable input renders
 * as-is instead of throwing.
 */

const DATE_PARSE = (isoDate: string) => new Date(`${isoDate}T00:00:00`);

/** Money in MXN, e.g. "$1,234.50". Non-numeric input renders as "—". */
export const currency = (value?: number | string): string =>
  typeof value === "string" || typeof value === "number"
    ? Number(value).toLocaleString("es-mx", {
        style: "currency",
        currency: "MXN"
      })
    : "—";

/** Long date for event cards, e.g. "sábado, 12 de septiembre de 2026". */
export const formatEventDate = (isoDate: string): string => {
  try {
    return DATE_PARSE(isoDate).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return isoDate;
  }
};

/** Compact date with weekday, e.g. "sáb, 12 sep". */
export const formatShortDate = (isoDate: string): string => {
  try {
    return DATE_PARSE(isoDate).toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
  } catch {
    return isoDate;
  }
};

/** Admin-list date without weekday, e.g. "12 sep 2026". */
export const formatAdminDate = (isoDate: string): string => {
  try {
    return DATE_PARSE(isoDate).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return isoDate;
  }
};

/** Day number + short month for the event-style date badge. */
export const getDateParts = (
  isoDate: string
): { day: string; month: string } | null => {
  try {
    return {
      day: String(DATE_PARSE(isoDate).getDate()),
      month: DATE_PARSE(isoDate)
        .toLocaleDateString("es-MX", { month: "short" })
        .replace(".", "")
    };
  } catch {
    return null;
  }
};

/** True when the calendar day is strictly before today (local time). */
export const isPastDate = (isoDate: string): boolean => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return DATE_PARSE(isoDate) < today;
  } catch {
    return false;
  }
};
