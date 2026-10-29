import type { ReactNode } from "react";

type StatusPanelProps = {
  icon: string;
  /** Small orange label above the title (optional). */
  eyebrow?: string;
  title: string;
  text?: ReactNode;
  /** Buttons / links, centered under the text. */
  actions?: ReactNode;
  /** Anything under the actions (e.g. "te reenviamos el enlace"). */
  footer?: ReactNode;
};

/**
 * Centered full-page state for the storefront (empty cart, log in first,
 * verify your email, load failed): one icon, one message, clear next steps.
 */
export function StatusPanel({ icon, eyebrow, title, text, actions, footer }: StatusPanelProps) {
  return (
    <section className="relative isolate mx-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-navy/10 bg-cream px-6 py-12 text-center shadow-panel sm:rounded-[36px] sm:px-12 sm:py-16">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-stripes" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(248,209,90,0.35), transparent 70%)" }}
      />
      <span
        aria-hidden="true"
        className="success-pop mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-3xl shadow-card ring-1 ring-navy/10"
      >
        {icon}
      </span>
      {eyebrow ? (
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">{eyebrow}</p>
      ) : null}
      <h1 className={`${eyebrow ? "mt-2" : "mt-6"} font-display text-2xl leading-tight text-denim sm:text-3xl`}>{title}</h1>
      {text ? <div className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-navy/75">{text}</div> : null}
      {actions ? (
        <div className="mt-8 grid gap-3 min-[480px]:flex min-[480px]:flex-wrap min-[480px]:justify-center">{actions}</div>
      ) : null}
      {footer ? <div className="mt-4 text-sm font-semibold text-denim">{footer}</div> : null}
    </section>
  );
}
