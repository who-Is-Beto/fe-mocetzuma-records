import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "./Button";
import { SearchBar } from "./SearchBar";
import logo from "../assets/logo.png";
import { useAuth } from "../app/providers/AuthProvider";

export function Navbar(): ReactNode {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const [params] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(params.get("search") ?? "");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [hideMobileNav, setHideMobileNav] = useState(false);
  const lastScrollRef = useRef(0);

  const accountLink = isAuthenticated
    ? { label: user?.name ?? "Perfil", href: "/perfil", shortLabel: "Perfil" }
    : { label: "Iniciar Sesión", href: "/login", shortLabel: "Acceso" };

  const navLinks = [
    { label: "Bazares", href: "/bazares" },
    { label: "Carritos", href: "/carritos" },
    accountLink
  ];

  const bottomLinks = [
    { label: "Inicio", icon: "🏠", href: "/" },
    { label: "Bazares", icon: "🛍️", href: "/bazares" },
    { label: "Carritos", icon: "🛒", href: "/carritos" },
    {
      label: accountLink.shortLabel ?? accountLink.label,
      icon: isAuthenticated ? "👤" : "💿",
      href: accountLink.href
    }
  ];

  const submitSearch = (term: string) => {
    const query = term.trim();
    if (!query) {
      navigate("/");
      return;
    }
    navigate(`/?search=${encodeURIComponent(query)}&page=1`);
  };

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      const delta = current - lastScrollRef.current;
      if (Math.abs(delta) < 6) return;
      if (current > lastScrollRef.current && current > 24) {
        setHideMobileNav(true);
      } else {
        setHideMobileNav(false);
      }
      lastScrollRef.current = current;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav className="relative mx-auto hidden w-full max-w-6xl items-center gap-4 px-6 py-6 md:grid md:grid-cols-[auto,1fr,auto] md:px-10">
        <NavLink to="/" aria-label="Inicio" className="shrink-0">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Moctezuma Records" className="h-12 w-auto" />
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
            <div className="hidden min-w-[220px] max-w-md flex-1 lg:block">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                onSubmit={submitSearch}
                placeholder="Buscar en catálogo..."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 rounded-pill border border-navy/10 bg-white/60 px-3 py-2 text-sm font-semibold text-navy shadow-sm">
              <span className="text-lg">👋</span>
              <span className="max-w-[140px] truncate sm:max-w-[220px]">{user?.name ?? "Perfil"}</span>
              <Button tone="outline" className="px-3 py-2 text-xs" onClick={logout}>
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
          <Button tone="orange" disabled className="px-4 py-2 text-sm whitespace-nowrap">
            Ver carrito
          </Button>
        </div>
      </nav>

      {showMobileSearch ? (
        <div className="fixed inset-x-4 bottom-28 z-30 rounded-2xl border border-navy/10 bg-sand px-4 py-3 shadow-panel backdrop-blur md:hidden">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onSubmit={(term) => {
              submitSearch(term)
              setShowMobileSearch(false)
            }}
            placeholder="Buscar en catálogo..."
          />
        </div>
      ) : null}

      <nav
        className={`fixed inset-x-0 bottom-4 z-20 mx-auto w-[min(480px,calc(100%-28px))] transition-transform duration-200 md:hidden ${
          hideMobileNav ? "translate-y-[120%]" : "translate-y-0"
        }`}
      >
        <div className="rounded-2xl border bg-sand border-navy/10 px-4 py-3 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between text-center gap-2">
            {bottomLinks.map((link) => (
              <NavLink
                key={link.label}
                to={link.href}
                className={({ isActive }) =>
                  `flex h-12 flex-1 flex-col items-center justify-center rounded-xl border text-[11px] leading-tight font-semibold transition hover:-translate-y-0.5 hover:border-orange hover:bg-sun/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange ${
                    isActive ? "border-orange bg-sun/70 text-navy" : "border-transparent text-navy"
                  }`
                }
              >
                <span className="text-xl">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
            <Button
              tone="outline"
              pill={false}
              className={`flex h-12 flex-1 gap-0 flex-col items-center justify-center rounded-xl px-0 py-0 text-xs font-semibold text-center shadow-none hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${
                showMobileSearch ? "border border-orange bg-sun/70 text-navy" : "border-none bg-transparent px-[1px] text-navy"
              }`}
              onClick={() => setShowMobileSearch((prev) => !prev)}
              aria-label={showMobileSearch ? "Cerrar búsqueda" : "Abrir búsqueda"}
            >
              <span className="text-xl">🔎</span>
              <span>Buscar</span>
            </Button>
          </div>
        </div>
      </nav>
    </>
  );
}
