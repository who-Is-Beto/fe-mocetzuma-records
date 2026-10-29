import { useEffect } from "react";
import { Link } from "react-router-dom";
import { loadAnalytics, setConsent, useConsent } from "../app/lib/consent";

/**
 * Cookie notice, shown until the visitor decides. Reject is exactly as easy
 * and as visible as accept. On phones it floats above the bottom nav; the
 * footer's "Preferencias de cookies" brings it back to change the choice.
 */
export function CookieBanner() {
  const consent = useConsent();

  // Analytics start only once consent exists (this visit or a previous one).
  useEffect(() => {
    if (consent === "accepted") loadAnalytics();
  }, [consent]);

  if (consent !== null) return null;

  return (
    <section
      aria-labelledby="cookie-title"
      aria-describedby="cookie-text"
      className="page-enter fixed inset-x-0 bottom-[6.5rem] z-40 mx-auto w-[min(720px,calc(100%-28px))] lg:bottom-6"
    >
      <div className="relative overflow-hidden rounded-[24px] border border-navy/10 bg-cream p-5 shadow-panel sm:flex sm:items-center sm:gap-6 sm:p-6">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-stripes" />
        <div className="flex gap-4">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sun/50 text-xl">
            🍪
          </span>
          <div className="min-w-0">
            <h2 id="cookie-title" className="font-display text-base text-denim">Tu privacidad, tu decisión</h2>
            <p id="cookie-text" className="mt-1.5 text-[13px] leading-relaxed text-navy/80">
              Para tu sesión y tu carrito usamos solo lo indispensable. Con tu permiso también
              guardamos preferencias y medimos visitas de forma anónima.{" "}
              <Link to="/politica-de-privacidad" className="font-semibold text-denim underline decoration-orange/60 underline-offset-2 hover:text-orange">
                Más información
              </Link>
            </p>
          </div>
        </div>
        <div className="mt-4 grid shrink-0 grid-cols-2 gap-2 sm:mt-0 sm:flex sm:flex-col">
          <button
            type="button"
            onClick={() => setConsent("rejected")}
            className="min-h-[44px] rounded-pill border border-navy/20 bg-white px-5 text-sm font-semibold text-navy transition duration-300 hover:-translate-y-0.5 hover:border-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => setConsent("accepted")}
            className="min-h-[44px] rounded-pill bg-navy px-5 text-sm font-semibold text-cream transition duration-300 hover:-translate-y-0.5 hover:bg-denim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
          >
            Aceptar
          </button>
        </div>
      </div>
    </section>
  );
}
