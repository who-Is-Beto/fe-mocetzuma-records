import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "navy" | "orange" | "sun" | "outline";

type ButtonProps = {
  children: ReactNode;
  tone?: Tone;
  pill?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const toneClasses: Record<Tone, string> = {
  navy: "bg-navy text-cream hover:bg-denim disabled:hover:bg-navy",
  orange: "bg-orange text-charcoal hover:bg-amber disabled:hover:bg-orange",
  sun: "bg-sun text-charcoal hover:bg-amber disabled:hover:bg-sun",
  outline:
    "border border-navy/15 bg-cream text-navy hover:-translate-y-0.5 hover:border-orange hover:text-orange disabled:hover:bg-cream disabled:hover:border-navy/15 disabled:hover:text-navy"
};

export function Button({
  children,
  tone = "navy",
  pill = true,
  className = "",
  ...props
}: ButtonProps) {
  const radius = pill ? "rounded-pill" : "rounded-xl";
  const base =
    "inline-flex items-center justify-center gap-2 cursor-pointer px-4 py-2 text-sm font-semibold shadow-panel transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange disabled:cursor-not-allowed disabled:opacity-60 disabled:brightness-95 disabled:hover:translate-y-0 disabled:hover:shadow-panel";

  const composed = `${base} ${radius} ${toneClasses[tone]} ${className}`.trim();

  return (
    <button type="button" className={composed} {...props}>
      {children}
    </button>
  );
}

export default Button;
