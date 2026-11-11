/** Shared look of the Preventas admin screens (quiet panels, aligned figures). */
export const panel = "rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-card sm:p-5";
export const label = "text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/60";
export const input =
  "mt-1 min-h-[44px] w-full rounded-xl border border-navy/15 bg-white px-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-orange disabled:bg-navy/5 disabled:text-navy/50";
export const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-pill bg-orange px-5 text-sm font-semibold text-charcoal transition hover:-translate-y-0.5 hover:bg-amber active:translate-y-0 disabled:pointer-events-none disabled:opacity-50";
export const btnNavy =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-pill bg-navy px-5 text-sm font-semibold text-cream transition hover:-translate-y-0.5 hover:bg-denim active:translate-y-0 disabled:pointer-events-none disabled:opacity-50";
export const btnGhost =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-pill border border-navy/15 bg-white px-4 text-sm font-semibold text-navy transition hover:border-orange hover:text-orange disabled:pointer-events-none disabled:opacity-50";
export const errorBox = "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700";

export const STATUS_TONE: Record<string, string> = {
  pending_payment: "bg-navy/10 text-navy/70",
  apartado: "bg-sun/60 text-navy",
  pagado: "bg-sky-100 text-denim",
  listo: "bg-green-100 text-green-900",
  enviado: "bg-green-100 text-green-900",
  entregado: "bg-navy text-cream",
  vencido: "bg-coral/15 text-coral",
  cancelado: "bg-navy/10 text-navy/60"
};

export const PRESALE_STATUS: Record<string, string> = {
  draft: "Borrador",
  published: "Publicada",
  closed: "Cerrada"
};

export const METHOD_LABEL = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" } as const;
