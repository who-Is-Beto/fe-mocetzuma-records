import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "./Navbar";

type LayoutProps = {
  children: ReactNode;
};

const footerLinks = [
  { label: "Contacto", to: "/contacto" },
  { label: "Términos y condiciones", to: "/terminos-y-condiciones" },
  { label: "Privacidad", to: "/politica-de-privacidad" },
  { label: "Ayuda", to: "/ayuda" },
];

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-sand text-navy">
      <div className="relative isolate flex min-h-screen flex-col">
        <div className="pointer-events-none absolute inset-0 -z-20 retro-blob opacity-90" />
        <div className="pointer-events-none absolute -right-20 top-10 -z-10 h-72 w-[52rem] rotate-6 bg-stripes opacity-60 blur-[28px]" />

        <Navbar />

        <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 pb-28 pt-6 md:px-10 md:pb-16 md:pt-0 lg:pb-20">
          {children}
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
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
