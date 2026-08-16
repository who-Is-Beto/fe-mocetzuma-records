import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../app/providers/AuthProvider";

const badgeStyles =
  "inline-flex items-center gap-2 rounded-pill border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-cream backdrop-blur-sm shadow-sm";

export function ProfilePage() {
  const { logout, user, isAuthenticated, emailVerified, resendVerification } = useAuth();
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const initials =
    user?.name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "MR";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isVerified = emailVerified === true;
  const showVerification = emailVerified === false || emailVerified === null;

  const handleResend = async () => {
    if (!user?.email) return;
    setResendStatus("sending");
    try {
      await resendVerification(user.email);
      setResendStatus("sent");
    } catch {
      setToast({
        message: "No pudimos reenviar el correo. Intenta de nuevo.",
        tone: "error"
      });
      setResendStatus("idle");
    }
  };

  return (
    <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-5 shadow-panel backdrop-blur md:space-y-6 md:p-6">
      <div className="relative overflow-hidden rounded-[24px] border border-navy/10 bg-gradient-to-br from-denim via-navy to-charcoal p-5 text-cream shadow-panel sm:p-6">
        <div className="pointer-events-none absolute -left-10 -top-12 h-32 w-32 rounded-full bg-orange/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 right-2 h-36 w-36 rounded-full bg-sun/25 blur-3xl" />

        <div className="relative flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/20 text-base font-bold text-cream shadow-inner sm:h-16 sm:w-16 sm:text-lg">
            {initials}
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-sun/90">
              Perfil activo
            </p>
            <h1 className="font-display text-2xl leading-tight sm:text-3xl">
              Hola, {user?.name ?? "Vinyl fan"}
            </h1>
            <p className="text-sm text-cream/80 break-all">
              {user?.email ?? "Sin correo registrado"}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className={badgeStyles}>Sesión segura</span>
              <span className={badgeStyles}>Guardado en este navegador</span>
              {isVerified ? (
                <span className="inline-flex items-center gap-2 rounded-pill border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-cream backdrop-blur-sm shadow-sm">
                  ✓ Correo verificado
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-pill border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-cream backdrop-blur-sm shadow-sm">
                  ✉️ Verificación pendiente
                </span>
              )}
            </div>
          </div>
          <div className="ml-auto">
            <Button
              tone="outline"
              className="px-4 py-2 text-xs text-cream border-white/40 sm:text-sm"
              onClick={logout}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>

      {showVerification ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-orange/40 bg-orange/10 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.16em] text-orange">
              Correo pendiente de verificación
            </p>
            <p className="text-sm text-navy/80">
              Confirma tu correo para poder agregar discos al carrito y pagar.
              Revisa tu bandeja de entrada o solicita un nuevo enlace.
            </p>
            {resendStatus === "sent" ? (
              <p className="text-sm font-semibold text-denim">
                Te reenviamos el enlace. Revisa tu bandeja de entrada.
              </p>
            ) : null}
          </div>
          <Button
            tone="orange"
            className="shrink-0"
            disabled={resendStatus === "sending"}
            onClick={handleResend}
          >
            {resendStatus === "sending"
              ? "Enviando..."
              : "Reenviar enlace de verificación"}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-navy/10 bg-white/80 p-4 text-sm text-navy shadow-card">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sun/60 text-lg shadow-inner">
            ✓
          </span>
          <div>
            <p className="font-semibold text-denim">Correo verificado</p>
            <p className="text-xs text-navy/70">
              Tu cuenta está verificada: puedes agregar al carrito y pagar sin
              restricciones.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-card sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-orange">
                Resumen
              </p>
              <h2 className="font-display text-xl text-denim">Tu sesión</h2>
            </div>
            <span className="rounded-pill bg-sun/50 px-3 py-1 text-xs font-semibold text-navy shadow-inner">
              Activa
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-navy/10 bg-cream/70 p-4 text-sm text-navy shadow-inner">
              <p className="text-xs uppercase tracking-[0.14em] text-orange">
                Usuario
              </p>
              <p className="font-semibold text-denim break-all">
                {user?.name ?? "Sin nombre"}
              </p>
              <p className="text-xs text-navy/70 break-all">
                {user?.email ?? "correo pendiente"}
              </p>
            </div>
            <div className="rounded-xl border border-navy/10 bg-cream/70 p-4 text-sm text-navy shadow-inner">
              <p className="text-xs uppercase tracking-[0.14em] text-orange">
                Estado
              </p>
              <p className="font-semibold text-denim">Sesión guardada</p>
              <p className="text-xs text-navy/70">
                Tu sesión se mantiene en este navegador entre pestañas y
                visitas.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-card sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-orange">
            Acciones rápidas
          </p>
          <div className="mt-3 grid gap-2">
            <Link
              to="/"
              className="rounded-pill border border-orange/60 bg-orange px-4 py-2 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
            >
              Volver al catálogo
            </Link>
            <Link
              to="/mis-ordenes"
              className="rounded-pill border border-navy/15 bg-cream px-4 py-2 text-sm font-semibold text-navy shadow-panel transition hover:-translate-y-0.5 hover:border-orange hover:text-orange"
            >
              Ver mis ordenes
            </Link>
            <Button
              tone="outline"
              className="px-4 py-2 text-sm"
              onClick={logout}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>

      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}
    </section>
  );
}

export default ProfilePage;
