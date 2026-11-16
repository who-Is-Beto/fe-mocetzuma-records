import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { createPresaleService } from "../../app/services/presaleService";
import { SuccessCheck } from "../SuccessCheck";

type Props = {
  /** "band": the footer invitation on every page. "compact": inside another card (closed presale). */
  variant?: "band" | "compact";
};

const PERKS = ["Te avisamos el día que abre", "Apartas antes de que se acaben", "Un correo por preventa, sin spam"];

/**
 * "Avísame de nuevas preventas". Visitors leave an email and confirm it from
 * their inbox; logged-in users switch it on with one tap (their email is
 * verified). Nothing is stored in the browser.
 */
export function SubscribeBox({ variant = "band" }: Props) {
  const { token, user } = useAuth();
  const ids = useId();
  const service = useMemo(() => createPresaleService({ getToken: () => token ?? null }), [token]);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "on" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let alive = true;
    service
      .subscription()
      .then((res) => alive && res.subscribed && setStatus("on"))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [service, token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!token && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Escribe un correo válido, como tu@correo.com.");
      return;
    }
    setStatus("sending");
    try {
      if (token) {
        await service.setSubscription(true);
        setStatus("on");
      } else {
        await service.subscribe(email.trim(), website);
        setStatus("sent");
      }
    } catch {
      setStatus("error");
      setError("No pudimos guardarlo. Intenta de nuevo en un momento.");
    }
  };

  const done = status === "sent" || status === "on";
  const band = variant === "band";
  const doneText =
    status === "on"
      ? `Listo: te escribimos a ${user?.email ?? "tu correo"} cuando abra una preventa.`
      : "Revisa tu correo y confirma con un clic. Si no lo ves, busca en spam o promociones.";

  const form = (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-2 min-[480px]:flex-row">
      {!token && (
        <label className="min-w-0 flex-1">
          <span className="sr-only">Tu correo</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${ids}-error` : undefined}
            className={`min-h-[52px] w-full rounded-pill border px-5 text-base text-navy placeholder:text-navy/45 focus:outline-none focus:ring-2 focus:ring-orange ${
              band ? "border-transparent bg-cream" : "border-navy/15 bg-white"
            }`}
          />
        </label>
      )}
      {/* Honeypot: hidden from people, filled by bots. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-pill bg-orange px-6 text-sm font-semibold text-charcoal transition duration-300 hover:-translate-y-0.5 hover:bg-amber active:translate-y-0 disabled:opacity-60 motion-reduce:hover:translate-y-0"
      >
        <span aria-hidden="true">🔔</span>
        {status === "sending" ? "Guardando…" : token ? "Activar avisos" : "Avísame"}
      </button>
    </form>
  );

  const errorLine = error ? (
    <p id={`${ids}-error`} role="alert" className={`mt-2 text-sm ${band ? "text-sun" : "text-coral"}`}>
      {error}
    </p>
  ) : null;

  if (!band) {
    return done ? (
      <p role="status" className="flex items-center gap-3 text-sm text-navy">
        <SuccessCheck className="h-8 w-8" />
        {doneText}
      </p>
    ) : (
      <div>
        <p className="mb-2 text-sm text-navy/75">Déjanos tu correo y te avisamos de la próxima.</p>
        {form}
        {errorLine}
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="relative overflow-hidden rounded-[26px] bg-navy px-5 py-6 text-cream shadow-panel sm:px-8 sm:py-8"
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-stripes" />
      {/* A record peeking from the corner: decoration only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[repeating-radial-gradient(circle,#1b1f2a_0_2px,#22303f_2px_5px)] opacity-60 sm:-right-10 sm:h-56 sm:w-56"
      >
        <span className="absolute inset-[38%] rounded-full bg-orange" />
      </div>

      <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-center md:gap-10">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange">Preventas</p>
          <h2 id={`${ids}-title`} className="mt-2 font-display text-xl leading-tight text-cream sm:text-2xl">
            Sé el primero en apartar
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-cream/80">
            Las copias de preventa son pocas y se van rápido. Déjanos tu correo y te escribimos en cuanto abra una.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-1.5 rounded-pill bg-cream/10 px-3 py-1 text-xs text-cream/90 ring-1 ring-cream/15">
                <span aria-hidden="true" className="text-sun">✓</span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          {done ? (
            <div role="status" className="flex items-center gap-4 rounded-2xl bg-cream/10 p-4 ring-1 ring-cream/15">
              <SuccessCheck className="h-12 w-12" />
              <p className="text-sm leading-relaxed text-cream">{doneText}</p>
            </div>
          ) : (
            <>
              {form}
              {errorLine}
              <p className="mt-2 text-xs text-cream/60">Te das de baja con un clic desde cualquier correo.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
