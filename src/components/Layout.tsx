import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigationType } from "react-router-dom";
import { useMaintenanceStatus } from "../app/hooks/useMaintenanceStatus";
import { MaintenanceStatusContext } from "../app/providers/MaintenanceStatusContext";
import { useAuth } from "../app/providers/AuthProvider";
import { PageSkeleton } from "./Skeleton";
import { Navbar } from "./Navbar";
import { AdminMaintenanceBar } from "./AdminMaintenanceBar";
import { CookieBanner } from "./CookieBanner";
import { resetConsent } from "../app/lib/consent";

// Loaded only when the maintenance window is actually open.
const MaintenancePage = lazy(() =>
  import("../pages/maintenance/MaintenancePage").then((m) => ({ default: m.MaintenancePage }))
);

type LayoutProps = {
  children: ReactNode;
};

const footerLinks = [
  { label: "Contacto", to: "/contacto" },
  { label: "Términos y condiciones", to: "/terminos-y-condiciones" },
  { label: "Privacidad", to: "/politica-de-privacidad" },
  { label: "Ayuda", to: "/ayuda" },
];

// Routes that stay reachable while the maintenance window is open: the home
// view (renders a maintenance notice instead of the catalog) and the auth
// flows, which the middleware deliberately keeps answering so an admin who
// got logged out can log back in and close the window.
const MAINTENANCE_VISIBLE_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/verificar-correo",
  "/olvidaste-contrasena",
  "/restablecer-contrasena",
]);

export function Layout({ children }: LayoutProps) {
  // Maintenance gate. The status is polled for everyone (including admins) so
  // the storefront can react live when the window flips open/closed in the
  // admin console. Admins skip the gate and see a quick-close bar instead.
  // ADMINs, or a custom role allowed to open/close the window (Roles tab).
  const { hasPerm } = useAuth();
  const canManageMaintenance = hasPerm("apiApp.change_siteconfig");
  const { pathname } = useLocation();
  // POP = browser back/forward (or a back button using navigate(-1)).
  const navigationType = useNavigationType();
  // No entrance on the first page of the visit: fading the hero in would
  // only delay its first paint (LCP). Every later navigation animates.
  const [firstPath] = useState(pathname);
  const [navigated, setNavigated] = useState(false);
  // Render-time sync with the path (no effect needed).
  if (!navigated && pathname !== firstPath) setNavigated(true);
  const pageMotion = !navigated ? "" : navigationType === "POP" ? "page-back" : "page-enter";
  const { config, isLoading, refetch } = useMaintenanceStatus({ enabled: true });
  const maintenanceActive = config?.maintenance_mode === true;

  if (!canManageMaintenance) {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-sand px-6 md:px-10">
          <div className="mx-auto max-w-6xl">
            <PageSkeleton />
          </div>
        </div>
      );
    }
    if (maintenanceActive && !MAINTENANCE_VISIBLE_PATHS.has(pathname)) {
      return (
        <Suspense
          fallback={
            <div className="min-h-screen bg-sand px-6 md:px-10">
              <div className="mx-auto max-w-6xl">
                <PageSkeleton />
              </div>
            </div>
          }
        >
          <MaintenancePage message={config.maintenance_message} />
        </Suspense>
      );
    }
  }

  return (
    <MaintenanceStatusContext.Provider value={{ config, isLoading, refetch }}>
      <div className="min-h-screen overflow-x-hidden bg-sand text-navy">
        <div className="relative isolate flex min-h-screen flex-col">
          <div className="pointer-events-none absolute inset-0 -z-20 retro-blob opacity-90" />
          <div className="pointer-events-none absolute -right-20 top-10 -z-10 h-72 w-[52rem] rotate-6 bg-stripes opacity-60 blur-[28px]" />

          {canManageMaintenance && maintenanceActive && pathname !== "/admin" ? (
            <AdminMaintenanceBar />
          ) : null}

          <Navbar />

          <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 pb-28 pt-6 md:px-10 lg:pb-20 lg:pt-0">
            {/* Keyed by path: each page change replays the entrance (query-string
                changes like catalog filters don't). */}
            <div key={pathname} className={`flex flex-1 flex-col ${pageMotion}`}>
              {children}
            </div>
          </main>

          <footer className="relative mt-auto border-t border-navy/10 bg-cream/70 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 text-sm text-navy/70 md:flex-row md:items-center md:justify-between md:px-10">
              <div className="flex items-center gap-3">
                <span className="text-lg">🎵</span>
                <p className="font-semibold text-denim">
                  Moctezuma Records © {new Date().getFullYear()}
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                {footerLinks.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="text-sm font-semibold text-navy transition hover:text-orange"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={resetConsent}
                  className="text-sm font-semibold text-navy transition hover:text-orange"
                >
                  Preferencias de cookies
                </button>
              </div>
            </div>
          </footer>
          <CookieBanner />
        </div>
      </div>
    </MaintenanceStatusContext.Provider>
  );
}