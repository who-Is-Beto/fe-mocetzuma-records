import { Link } from 'react-router-dom'
import { usePageTitle } from "../app/hooks/usePageTitle";
import { T } from '../app/i18n/strings'

export function NotFoundPage() {
  usePageTitle(T.notFound.pageTitle);
  return (
    <section className="space-y-4 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
      <p className="text-xs uppercase tracking-[0.18em] text-orange">404</p>
      <h1 className="font-display text-3xl text-denim">{T.notFound.title}</h1>
      <p className="text-sm text-navy/70">{T.notFound.message}</p>
      <div className="mt-2 flex justify-center gap-3">
        <Link
          to="/"
          className="rounded-pill border border-navy/10 bg-cream px-4 py-2 text-sm font-semibold text-navy shadow-sm transition hover:-translate-y-0.5 hover:border-orange"
        >
          {T.notFound.backHome}
        </Link>
        <Link
          to="/perfil"
          className="rounded-pill border border-orange/60 bg-orange px-4 py-2 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
        >
          {T.notFound.profile}
        </Link>
      </div>
    </section>
  )
}

export default NotFoundPage
