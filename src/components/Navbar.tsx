import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "./Button";
import { SearchBar } from "./SearchBar";
import logo from "../assets/logo.png";
import { useAuth } from "../app/providers/AuthProvider";
import { Img } from "./Img";
import type { Record as AlbumRecord } from "../app/domain/album";

export function Navbar(): ReactNode {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, canAccessAdmin } = useAuth();
  const [params] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(params.get("search") ?? "");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [hideMobileNav, setHideMobileNav] = useState(false);
  const lastScrollRef = useRef(0);

  const accountLink = isAuthenticated
    ? { label: user?.name ?? "Perfil", href: "/perfil", shortLabel: "Perfil" }
    : { label: "Iniciar Sesión", href: "/login", shortLabel: "Acceso" };

  const navLinks = [{ label: "Bazares", href: "/bazares" }];

  const bottomLinks = [
    { label: "Inicio", icon: "🏠", href: "/" },
    { label: "Bazares", icon: "🛍️", href: "/bazares" },
    { label: "Carrito", icon: "🛒", href: "/carrito" },
    {
      label: accountLink.shortLabel ?? accountLink.label,
      icon: isAuthenticated ? "👤" : "💿",
      href: accountLink.href
    }
  ];

  // The catalog's "Solo disponibles" switch (?available=false = show sold out).
  // Suggestions and searches follow it, so sold-out records only appear when
  // the viewer turned it off.
  const includeUnavailable = params.get("available") === "false";

  const submitSearch = (term: string) => {
    const query = term.trim();
    const next = new URLSearchParams();
    if (query) next.set("search", query);
    if (includeUnavailable) next.set("available", "false");
    const qs = next.toString();
    navigate(qs ? `/catalogo?${qs}` : "/catalogo");
  };

  const openRecord = (record: AlbumRecord) => {
    setSearchTerm("");
    navigate(`/records/${record.slug ?? record.id}`);
  };

  useEffect(() => {
    let raf = 0;
    const handleScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const current = window.scrollY;
        const delta = current - lastScrollRef.current;
        if (Math.abs(delta) < 6) return;
        const docHeight = document.documentElement.scrollHeight;
        // Rubber-band overscroll at the page bottom (iOS/Android) fires
        // phantom upward deltas; without this guard the bar slides back up
        // and covers the footer exactly when the user reaches it.
        const nearPageBottom =
          current + window.innerHeight >= docHeight - 48;
        if (current > lastScrollRef.current && current > 24) {
          setHideMobileNav(true);
          setShowMobileSearch(false);
        } else if (!nearPageBottom) {
          setHideMobileNav(false);
        }
        lastScrollRef.current = current;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>
      <nav className="relative mx-auto hidden w-full max-w-6xl items-center gap-4 px-6 py-6 lg:grid lg:grid-cols-[auto,1fr,auto] lg:px-10">
        <NavLink to="/" aria-label="Inicio" className="shrink-0">
          <div className="flex items-center gap-3">
            <Img src={logo} alt="Moctezuma Records" width={66} height={48} priority placeholder={false} className="h-12 w-auto" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-orange">
                Moctezuma
              </p>
              <p className="font-display text-xl text-denim">Records</p>
            </div>
          </div>
        </NavLink>

        <div className="flex min-w-0 items-center gap-4">
          <div className="flex flex-1 items-center gap-4 overflow-hidden">
            <div className="flex items-center gap-4 overflow-hidden">
              {navLinks.map((link) => (
                <NavLink
                  key={link.label}
                  to={link.href}
                  className={({ isActive }) =>
                    `text-sm font-semibold whitespace-nowrap transition hover:text-orange ${
                      isActive ? "text-orange" : "text-navy"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
            <div className="min-w-[180px] max-w-md flex-1">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                onSubmit={submitSearch}
                onPickSuggestion={openRecord}
                includeUnavailable={includeUnavailable}
                placeholder="Buscar en catálogo..."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 rounded-pill border border-navy/10 bg-white/60 px-3 py-2 text-sm font-semibold text-navy shadow-sm">
              <span className="text-lg">👋</span>
              <NavLink
                to="/perfil"
                className="max-w-[140px] truncate sm:max-w-[220px] hover:text-orange"
              >
                {user?.name ?? "Perfil"}
              </NavLink>
              <Button
                tone="outline"
                className="px-3 py-2 text-xs"
                onClick={logout}
              >
                Salir
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                tone="outline"
                className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                onClick={() => navigate("/login")}
              >
                Iniciar sesión
              </Button>
              <Button
                tone="orange"
                className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                onClick={() => navigate("/register")}
              >
                Crear cuenta
              </Button>
            </div>
          )}
          {canAccessAdmin && (
            <Button
              tone="outline"
              className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
              onClick={() => navigate("/admin")}
              aria-label="Administración"
              title="Administración"
            >
              {/* Icon-only between lg and xl so the search box keeps its room */}
              🧰<span className="hidden xl:inline"> Administración</span>
            </Button>
          )}
          <Button
            tone="navy"
            className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
            onClick={() => navigate("/carrito")}
            aria-label="Carrito"
            title="Carrito"
          >
            🛒<span className="hidden xl:inline"> Carrito</span>
          </Button>
        </div>
      </nav>

      {/*
        Backdrop: taps outside the searchbar close it.
        Only visible on mobile when the searchbar is open.
      */}
      <div
        className={`fixed inset-0 z-29 bg-navy/20 backdrop-blur-sm transition-opacity duration-300 ease-out lg:hidden ${
          showMobileSearch
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setShowMobileSearch(false)}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-x-0 top-4 z-30 px-4 transition-all duration-300 ease-out lg:hidden ${
          showMobileSearch
            ? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
            : "-translate-y-2 opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="mx-auto max-w-6xl rounded-2xl border border-navy/10 bg-sand px-4 py-3 shadow-panel backdrop-blur">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onSubmit={(term) => {
              submitSearch(term);
              setShowMobileSearch(false);
            }}
            onPickSuggestion={(record) => {
              openRecord(record);
              setShowMobileSearch(false);
            }}
            includeUnavailable={includeUnavailable}
            placeholder="Buscar en catálogo..."
          />
        </div>
      </div>

      <nav
        className={`fixed inset-x-0 bottom-4 z-20 mx-auto w-[min(480px,calc(100%-28px))] transition-all duration-300 ease-out lg:hidden ${
          hideMobileNav ? "translate-y-[120%] opacity-0 scale-95" : "translate-y-0 opacity-100 scale-100"
        }`}
      >
        <div className="rounded-2xl border bg-sand border-navy/10 px-4 py-3 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between text-center gap-2">
            {bottomLinks.map((link) => (
              <NavLink
                key={link.label}
                to={link.href}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={({ isActive }) =>
                  `flex h-12 flex-1 flex-col items-center justify-center rounded-xl border text-[11px] leading-tight font-semibold transition hover:-translate-y-0.5 hover:border-orange hover:bg-sun/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange ${
                    isActive
                      ? "border-orange bg-sun/70 text-navy"
                      : "border-transparent text-navy"
                  }`
                }
              >
                <span className="text-xl">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
            <button
              type="button"
              className={`flex h-12 flex-1 flex-col items-center justify-center rounded-xl border text-[11px] leading-tight font-semibold transition hover:-translate-y-0.5 hover:border-orange hover:bg-sun/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange ${
                showMobileSearch
                  ? "border-orange bg-sun/70 text-navy"
                  : "border-transparent text-navy"
              }`}
              onClick={() => setShowMobileSearch((prev) => !prev)}
              aria-label={
                showMobileSearch ? "Cerrar búsqueda" : "Abrir búsqueda"
              }
            >
              <span className="text-xl">🔎</span>
              <span>Buscar</span>
            </button>
            {canAccessAdmin && (
              <NavLink
                to="/admin"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={({ isActive }) =>
                  `flex h-12 flex-1 flex-col items-center justify-center rounded-xl border text-[10px] leading-tight font-semibold transition hover:-translate-y-0.5 hover:border-orange hover:bg-sun/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange ${
                    isActive
                      ? "border-orange bg-sun/70 text-navy"
                      : "border-transparent text-navy"
                  }`
                }
              >
                <span className="text-lg">🧰</span>
                <span className="truncate">Admin</span>
              </NavLink>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
