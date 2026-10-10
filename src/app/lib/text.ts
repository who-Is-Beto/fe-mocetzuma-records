/** Case- and accent-insensitive comparison key: "Pop Español" ~ "pop espanol". */
export const normName = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
