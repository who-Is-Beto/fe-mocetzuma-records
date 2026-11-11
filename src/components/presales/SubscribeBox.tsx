import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { createPresaleService } from "../../app/services/presaleService";

type Props = { compact?: boolean };

/**
 * "Avísame de nuevas preventas". Visitors leave an email and confirm it from
 * their inbox; logged-in users switch it on directly (their email is verified).
 * Nothing is stored in the browser.
 */
export function SubscribeBox({ compact = false }: Props) {
  const { token, user } = useAuth();
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
      setError("Escribe un correo válido.");
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

  return (
    <div className={compact ? "" : "rounded-[22px] border border-navy/10 bg-white/70 p-5 sm:p-7"}>
      <div className={`flex flex-col md:flex-row md:items-center md:justify-between ${compact ? "gap-3 md:gap-8" : "gap-5"}`}>
        <div className="min-w-0">
          <p className={`font-semibold text-denim ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
            Avísame de nuevas preventas
          </p>
          <p className="mt-1 text-sm text-navy/70">
            {status === "on"
              ? `Te escribiremos a ${user?.email ?? "tu correo"} cuando abramos una.`
              : status === "sent"
                ? "Listo: revisa tu correo y confirma con un clic."
                : "Un correo por preventa, con precio y fecha límite. Te das de baja con un clic."}
          </p>
        </div>

        {!done && (
          <form onSubmit={submit} className={`flex min-w-0 flex-col gap-2 sm:flex-row md:w-[26rem] md:shrink-0`} noValidate>
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
                  aria-describedby={error ? "subscribe-error" : undefined}
                  className="min-h-[48px] w-full rounded-pill border border-navy/15 bg-white px-5 text-sm text-navy placeholder:text-navy/45 focus:outline-none focus:ring-2 focus:ring-orange"
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
              className="min-h-[48px] shrink-0 rounded-pill bg-navy px-6 text-sm font-semibold text-cream transition duration-300 hover:-translate-y-0.5 hover:bg-denim active:translate-y-0 disabled:opacity-60 motion-reduce:hover:translate-y-0"
            >
              {status === "sending" ? "Guardando…" : token ? "Avisarme por correo" : "Recibir avisos"}
            </button>
          </form>
        )}
      </div>
      {error ? (
        <p id="subscribe-error" role="alert" className="mt-2 text-sm text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}
