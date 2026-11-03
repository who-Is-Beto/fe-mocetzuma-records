import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";
import { MobileSearch } from "./MobileSearch";
import { Modal } from "./Modal";
import { SearchBar } from "./SearchBar";
import logo from "../assets/logo.webp";
import { useAuth } from "../app/providers/AuthProvider";
import { useWishlist } from "../app/providers/WishlistProvider";
import { Img } from "./Img";
import type { Record as AlbumRecord } from "../app/domain/album";

type AccountItem = { label: string; icon: string; href: string; badge?: number };

const badgeText = (n: number) => (n > 99 ? "99+" : String(n));

// Hover styles only where a real pointer hovers: phones keep the last tapped
// item ":hover" until the next tap, which looked like a stuck active state.
const bottomItemClass = (active: boolean) =>
  `flex h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-xl border text-[11px] leading-tight font-semibold transition active:scale-95 active:bg-sun/40 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-orange [@media(hover:hover)]:hover:bg-sun/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange ${
    active ? "border-orange bg-sun/70 text-navy" : "border-transparent text-navy"
  }`;

/** Hover / keyboard-focus label under an icon-only navbar button. */
function NavHint({ title, detail }: { title: string; detail?: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-full z-40 mt-3 -translate-x-1/2 translate-y-1 scale-95 whitespace-nowrap rounded-xl bg-navy px-3 py-2 text-center text-cream opacity-0 shadow-card transition duration-200 ease-out group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-hover:delay-150 group-focus-visible:translate-y-0 group-focus-visible:scale-100 group-focus-visible:opacity-100"
    >
      <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-navy" />
      <span className="relative block text-xs font-semibold">{title}</span>
      {detail ? <span className="relative mt-0.5 block text-[11px] text-cream/70">{detail}</span> : null}
    </span>
  );
}

const roundIconClass =
  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg shadow-sm transition duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange";

export function Navbar(): ReactNode {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated, user, logout, canAccessAdmin } = useAuth();
  const { count: wishlistCount, changes: wishlistChanges } = useWishlist();
  const [params] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(params.get("search") ?? "");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [hideMobileNav, setHideMobileNav] = useState(false);
  const lastScrollRef = useRef(0);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const closeMobileSearch = useCallback(() => setShowMobileSearch(false), []);

  // Opened and focused inside the same tap: phones only raise the keyboard
  // for a focus() that happens during the user's gesture.
  const openMobileSearch = () => {
    flushSync(() => setShowMobileSearch(true));
    mobileSearchInputRef.current?.focus({ preventScroll: true });
  };

  const name = user?.name ?? "Perfil";
  const initial = name.trim().charAt(0).toUpperCase() || "👤";

  // Everything account-related lives in one menu (desktop dropdown, mobile
  // sheet) instead of a row of buttons.
  const accountItems: AccountItem[] = [
    { label: "Mi perfil", icon: "👤", href: "/perfil" },
    { label: "Mis órdenes", icon: "📦", href: "/mis-ordenes" },
    { label: "Favoritos", icon: "💛", href: "/favoritos", badge: wishlistCount },
    ...(canAccessAdmin ? [{ label: "Administración", icon: "🧰", href: "/admin" }] : [])
  ];
  const onAccountPage = accountItems.some((item) => pathname.startsWith(item.href));

  // Bottom nav is always 5 items so every label fits down to 320px. Admins
  // get their panel one tap away in place of Bazares (still in the sheet).
  const secondLink = canAccessAdmin
    ? { label: "Admin", icon: "🧰", href: "/admin" }
    : { label: "Bazares", icon: "🛍️", href: "/bazares" };
  const sheetItems: AccountItem[] = canAccessAdmin
    ? [...accountItems.filter((item) => item.href !== "/admin"), { label: "Bazares", icon: "🛍️", href: "/bazares" }]
    : accountItems;

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

  const signOut = () => {
    setShowAccountSheet(false);
    logout();
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

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <>
      <nav className="relative z-30 mx-auto hidden w-full max-w-6xl items-center gap-6 px-6 py-6 lg:grid lg:grid-cols-[auto,1fr,auto] lg:px-10">
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

        <div className="flex min-w-0 items-center gap-5">
          <NavLink
            to="/bazares"
            className={({ isActive }) =>
              `text-sm font-semibold whitespace-nowrap transition hover:text-orange ${
                isActive ? "text-orange" : "text-navy"
              }`
            }
          >
            Bazares
          </NavLink>
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

        <div className="flex items-center justify-end gap-2.5">
          {isAuthenticated ? (
            <NavLink
              to="/favoritos"
              aria-label={`Favoritos (${wishlistCount})`}
              className={({ isActive }) =>
                `group ${roundIconClass} border ${
                  isActive ? "border-orange bg-sun/70" : "border-navy/10 bg-white/70 hover:border-coral/50"
                }`
              }
            >
              💛
              {wishlistCount > 0 ? (
                <span
                  key={wishlistChanges}
                  aria-hidden="true"
                  className="bump absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white shadow"
                >
                  {badgeText(wishlistCount)}
                </span>
              ) : null}
              <NavHint
                title="Favoritos"
                detail={wishlistCount ? `${wishlistCount} ${wishlistCount === 1 ? "disco guardado" : "discos guardados"}` : "Toca ♡ en un disco para guardarlo"}
              />
            </NavLink>
          ) : null}

          <NavLink
            to="/carrito"
            aria-label="Carrito"
            className={({ isActive }) =>
              `group ${roundIconClass} bg-navy text-cream hover:bg-denim ${isActive ? "ring-2 ring-orange ring-offset-2 ring-offset-sand" : ""}`
            }
          >
            🛒
            <NavHint title="Carrito" detail="Revisa y paga tu pedido" />
          </NavLink>

          {canAccessAdmin ? (
            <NavLink
              to="/admin"
              aria-label="Administración"
              className={({ isActive }) =>
                `group ${roundIconClass} border ${
                  isActive ? "border-orange bg-sun/70" : "border-navy/10 bg-white/70 hover:border-orange/50"
                }`
              }
            >
              🧰
              <NavHint title="Administración" detail="Inventario, ventas y punto de venta" />
            </NavLink>
          ) : null}

          {isAuthenticated ? (
            <Dropdown
              ariaLabel="Menú de cuenta"
              align="end"
              closeOnSelect
              triggerClassName={`ml-1 flex min-h-[44px] items-center gap-2 rounded-pill border py-1 pl-1 pr-3 text-sm font-semibold text-navy shadow-sm transition hover:border-orange/50 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 aria-expanded:border-orange/50 aria-expanded:bg-white ${
                onAccountPage ? "border-orange/50 bg-white" : "border-navy/10 bg-white/70"
              }`}
              label={
                <>
                  <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-orange font-display text-base text-charcoal">
                    {initial}
                  </span>
                  <span className="max-w-[120px] truncate xl:max-w-[160px]">{name}</span>
                </>
              }
            >
              <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy/60">Tu cuenta</p>
              {accountItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  role="menuitem"
                  className={({ isActive }) =>
                    `flex min-h-[40px] items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none transition hover:bg-sun/30 focus-visible:bg-sun/30 focus-visible:ring-2 focus-visible:ring-orange/40 ${
                      isActive ? "bg-sun/40 text-navy" : "text-navy"
                    }`
                  }
                >
                  <span aria-hidden="true" className="w-5 text-center">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-bold text-coral">{badgeText(item.badge)}</span>
                  ) : null}
                </NavLink>
              ))}
              <div className="my-1.5 border-t border-navy/10" />
              <button
                type="button"
                role="menuitem"
                onClick={logout}
                className="flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-navy/80 outline-none transition hover:bg-sun/30 hover:text-navy focus-visible:bg-sun/30 focus-visible:ring-2 focus-visible:ring-orange/40"
              >
                <span aria-hidden="true" className="w-5 text-center">↩</span>
                Cerrar sesión
              </button>
            </Dropdown>
          ) : (
            <div className="ml-1 flex items-center gap-2">
              <NavLink
                to="/login"
                className="whitespace-nowrap rounded-pill px-3 py-2 text-sm font-semibold text-navy transition hover:text-orange"
              >
                Iniciar sesión
              </NavLink>
              <Button
                tone="orange"
                className="px-4 py-2 text-sm whitespace-nowrap"
                onClick={() => navigate("/register")}
              >
                Crear cuenta
              </Button>
            </div>
          )}
        </div>
      </nav>

      <MobileSearch
        open={showMobileSearch}
        onClose={closeMobileSearch}
        value={searchTerm}
        onChange={setSearchTerm}
        onSubmit={submitSearch}
        onPickSuggestion={openRecord}
        includeUnavailable={includeUnavailable}
        inputRef={mobileSearchInputRef}
      />

      <nav
        aria-label="Navegación principal"
        className={`fixed inset-x-0 bottom-4 z-20 mx-auto w-[min(480px,calc(100%-28px))] transition-all duration-300 ease-out lg:hidden ${
          hideMobileNav ? "translate-y-[120%] opacity-0 scale-95" : "translate-y-0 opacity-100 scale-100"
        }`}
      >
        <div className="rounded-2xl border bg-sand border-navy/10 px-2 py-3 shadow-panel backdrop-blur min-[400px]:px-4">
          <div className="flex items-center justify-between gap-1 text-center min-[400px]:gap-2">
            <NavLink to="/" end onClick={scrollTop} className={({ isActive }) => bottomItemClass(isActive)}>
              <span aria-hidden="true" className="text-xl">🏠</span>
              <span className="max-w-full truncate">Inicio</span>
            </NavLink>

            <NavLink to={secondLink.href} onClick={scrollTop} className={({ isActive }) => bottomItemClass(isActive)}>
              <span aria-hidden="true" className="text-xl">{secondLink.icon}</span>
              <span className="max-w-full truncate">{secondLink.label}</span>
            </NavLink>

            <button
              type="button"
              className={bottomItemClass(showMobileSearch)}
              onClick={openMobileSearch}
              aria-haspopup="dialog"
              aria-label="Abrir búsqueda"
            >
              <span aria-hidden="true" className="text-xl">🔎</span>
              <span className="max-w-full truncate">Buscar</span>
            </button>

            <NavLink to="/carrito" onClick={scrollTop} className={({ isActive }) => bottomItemClass(isActive)}>
              <span aria-hidden="true" className="text-xl">🛒</span>
              <span className="max-w-full truncate">Carrito</span>
            </NavLink>

            {isAuthenticated ? (
              <button
                type="button"
                className={bottomItemClass(showAccountSheet || onAccountPage)}
                onClick={() => setShowAccountSheet(true)}
                aria-haspopup="dialog"
                aria-label={wishlistCount > 0 ? `Cuenta, ${wishlistCount} en favoritos` : "Cuenta"}
              >
                <span aria-hidden="true" className="relative flex h-7 w-7 items-center justify-center rounded-full bg-orange font-display text-sm text-charcoal">
                  {initial}
                  {wishlistCount > 0 ? (
                    <span
                      key={wishlistChanges}
                      className="bump absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-coral px-1 font-sans text-[9px] font-bold leading-none text-white shadow"
                    >
                      {badgeText(wishlistCount)}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">Cuenta</span>
              </button>
            ) : (
              <NavLink to="/login" onClick={scrollTop} className={({ isActive }) => bottomItemClass(isActive)}>
                <span aria-hidden="true" className="text-xl">💿</span>
                <span className="max-w-full truncate">Entrar</span>
              </NavLink>
            )}
          </div>
        </div>
      </nav>

      {isAuthenticated ? (
        <Modal open={showAccountSheet} onClose={() => setShowAccountSheet(false)} labelledBy="account-sheet-title" variant="sheet">
          <div className="flex items-center gap-3 pb-4">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange font-display text-xl text-charcoal">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange">Tu cuenta</p>
              <h2 id="account-sheet-title" className="truncate font-display text-xl text-denim">Hola, {name}</h2>
            </div>
          </div>
          <ul className="space-y-1.5">
            {sheetItems.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  onClick={() => {
                    setShowAccountSheet(false);
                    scrollTop();
                  }}
                  className={({ isActive }) =>
                    `flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 text-sm font-semibold text-navy transition hover:border-orange/50 hover:bg-sun/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
                      isActive ? "border-orange bg-sun/50" : "border-navy/10 bg-cream"
                    }`
                  }
                >
                  <span aria-hidden="true" className="w-6 text-center text-lg">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-coral/15 px-2 py-0.5 text-xs font-bold text-coral">{badgeText(item.badge)}</span>
                  ) : null}
                  <span aria-hidden="true" className="text-navy/40">›</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={signOut}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-pill border border-navy/15 text-sm font-semibold text-navy transition hover:border-orange hover:text-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
          >
            Cerrar sesión
          </button>
        </Modal>
      ) : null}
    </>
  );
}
