import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSeo } from "../../app/hooks/useSeo";
import { createPresaleService } from "../../app/services/presaleService";
import { StatusPanel } from "../../components/StatusPanel";
import { primaryCta } from "../../components/cta";

type Props = { mode: "confirm" | "unsubscribe" };

const COPY = {
  confirm: {
    ok: { icon: "📬", title: "Listo, te avisaremos", text: "Te escribiremos cada vez que abramos una preventa." },
    fail: { icon: "⏳", title: "Este enlace ya venció", text: "Suscríbete de nuevo desde el inicio; el enlace dura 7 días." }
  },
  unsubscribe: {
    ok: { icon: "👋", title: "Ya no te escribiremos", text: "Te diste de baja de los avisos de preventas. Puedes volver cuando quieras." },
    fail: { icon: "🔗", title: "Este enlace no es válido", text: "Ábrelo desde el último correo de preventas que recibiste." }
  }
} as const;

/** /preventas/confirmar?token= and /preventas/baja?token= (links from the emails). */
export function SubscriptionPage({ mode }: Props) {
  useSeo({ title: mode === "confirm" ? "Confirmar avisos de preventas" : "Darse de baja", noindex: true });
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const service = useMemo(() => createPresaleService(), []);
  const [state, setState] = useState<"loading" | "ok" | "fail">(token ? "loading" : "fail");

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (mode === "confirm" ? service.confirm(token) : service.unsubscribe(token))
      .then(() => alive && setState("ok"))
      .catch(() => alive && setState("fail"));
    return () => {
      alive = false;
    };
  }, [mode, service, token]);

  if (state === "loading") {
    return <StatusPanel icon="⏳" title={mode === "confirm" ? "Confirmando…" : "Dándote de baja…"} />;
  }
  const copy = COPY[mode][state];
  return (
    <StatusPanel
      icon={copy.icon}
      eyebrow="Preventas"
      title={copy.title}
      text={copy.text}
      actions={<Link to="/" className={primaryCta}>Ir al inicio</Link>}
    />
  );
}
