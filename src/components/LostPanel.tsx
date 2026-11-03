import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FreshPicks } from "./FreshPicks";
import { SearchBar } from "./SearchBar";
import { Vinyl } from "./Vinyl";

type LostPanelProps = {
  eyebrow: string;
  title: string;
  text: ReactNode;
  /** Main buttons / links under the text. */
  actions: ReactNode;
  /** Prefills the "Encárgalo" link (e.g. the record the visitor was after). */
  requestTitle?: string;
};

/**
 * Friendly dead end (unknown page, record that's gone): a "4 ◉ 4" with the
 * spinning record as the 0, a way out, a catalog search right there and an
 * offer to order what they couldn't find.
 */
export function LostPanel({ eyebrow, title, text, actions, requestTitle }: LostPanelProps) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const requestHref = requestTitle ? `/encargar?title=${encodeURIComponent(requestTitle)}` : "/encargar";

  return (
    <div className="mx-auto w-full max-w-4xl">
      <section className="relative isolate mx-auto w-full max-w-3xl overflow-hidden rounded-[28px] border border-navy/10 bg-cream px-5 py-10 text-center shadow-panel sm:rounded-[36px] sm:px-12 sm:py-14">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-stripes" />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(248,209,90,0.35), transparent 70%)" }}
        />

        <div aria-hidden="true" className="page-enter flex items-center justify-center gap-2 font-display text-[5.5rem] leading-none text-denim sm:gap-3 sm:text-[8rem]">
          <span>4</span>
          <div className="h-[0.82em] w-[0.82em]">
            <Vinyl />
          </div>
          <span>4</span>
        </div>

        <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">{eyebrow}</p>
        <h1 className="mx-auto mt-2 max-w-lg font-display text-2xl leading-tight text-denim sm:text-3xl">{title}</h1>
        <div className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-navy/75">{text}</div>

        <div className="mt-8 grid gap-3 min-[480px]:flex min-[480px]:flex-wrap min-[480px]:justify-center">{actions}</div>

        <div className="mx-auto mt-10 max-w-md border-t border-navy/10 pt-8 text-left">
          <p className="mb-2.5 text-center text-sm font-semibold text-navy">¿Buscabas algún disco?</p>
          <SearchBar
            value={term}
            onChange={setTerm}
            onSubmit={(value) => navigate(value.trim() ? `/catalogo?search=${encodeURIComponent(value.trim())}` : "/catalogo")}
            onPickSuggestion={(record) => navigate(`/records/${record.slug ?? record.id}`)}
            placeholder="Disco o artista…"
          />
          <p className="mt-4 text-center text-sm text-navy/70">
            ¿No lo tenemos?{" "}
            <Link to={requestHref} className="font-semibold text-denim underline decoration-orange/60 underline-offset-4 transition hover:text-orange">
              Encárgalo y te lo buscamos
            </Link>
          </p>
        </div>
      </section>
      <FreshPicks />
    </div>
  );
}
