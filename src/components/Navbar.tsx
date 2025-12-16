import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const navLinks = [
  { label: "Inicio", href: "/" },
  { label: "Album", href: "/albums/rumours" },
  { label: "Carrito", href: "/dashboard" },
  {
    label: false ? "Perfil" : "Iniciar Sesión",
    href: false ? "/perfil" : "/login"
  }
];

const bottomLinks = [
  { label: "Inicio", icon: "🏠", href: "/" },
  { label: "Album", icon: "🎧", href: "/albums/rumours" },
  { label: "Carrito", icon: "🛒", href: "/carrito" },
  {
    label: false ? "Perfil" : "Iniciar Sesión",
    icon: false ? "🔐" : "💿",
    href: false ? "/perfil" : "/login"
  }
];

export function Navbar(): ReactNode {
  return (
    <>
      <nav className="relative mx-auto hidden w-full max-w-6xl items-center justify-between gap-4 px-6 py-6 md:flex md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-2xl text-cream shadow-panel">
            🟠
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-orange">
              EverBriit
            </p>
            <p className="font-display text-xl text-denim">Bada Boom UI</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {navLinks.map((link) => (
            <NavLink
              key={link.label}
              to={link.href}
              className={({ isActive }) =>
                `text-sm font-semibold transition hover:text-orange ${
                  isActive ? "text-orange" : "text-navy"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <button className="rounded-pill border border-orange/60 bg-orange px-4 py-2 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange">
          Add vinyl drop
        </button>
      </nav>

      <nav className="fixed inset-x-0 bottom-4 z-20 mx-auto w-[min(480px,calc(100%-28px))] rounded-2xl border border-navy/10 bg px-4 py-3 shadow-panel backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-2">
          {bottomLinks.map((link) => (
            <NavLink
              key={link.label}
              to={link.href}
              className={({ isActive }) =>
                `flex h-12 flex-1 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition hover:-translate-y-0.5 hover:border-orange hover:bg-sun/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange ${
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
        </div>
      </nav>
    </>
  );
}
