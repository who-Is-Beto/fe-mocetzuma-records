import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { createPresaleService } from "../../app/services/presaleService";

/** Mi perfil: switch for the new-presale emails (verified accounts skip the confirmation email). */
export function PresaleAlertsToggle() {
  const { token, user } = useAuth();
  const service = useMemo(() => createPresaleService({ getToken: () => token ?? null }), [token]);
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let alive = true;
    service
      .subscription()
      .then((res) => alive && setOn(res.subscribed))
      .catch(() => alive && setOn(false));
    return () => {
      alive = false;
    };
  }, [service, token]);

  const toggle = async () => {
    if (on === null) return;
    setSaving(true);
    setError("");
    try {
      setOn((await service.setSubscription(!on)).subscribed);
    } catch {
      setError("No pudimos guardar el cambio. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-card sm:p-5">
      <div className="min-w-0">
        <p id="presale-alerts-label" className="font-semibold text-denim">
          Avísame de nuevas preventas
        </p>
        <p className="mt-0.5 text-sm text-navy/70">
          {on ? `Te escribimos a ${user?.email ?? "tu correo"} cuando abrimos una.` : "Un correo por preventa, con precio y fecha límite."}
        </p>
        {error && <p role="alert" className="mt-1 text-sm text-coral">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on === true}
        aria-labelledby="presale-alerts-label"
        disabled={on === null || saving}
        onClick={toggle}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange disabled:opacity-60 ${
          on ? "bg-orange" : "bg-navy/20"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform duration-300 ${on ? "translate-x-7" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}
