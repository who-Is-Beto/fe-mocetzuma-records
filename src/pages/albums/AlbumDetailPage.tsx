import { Link, useParams } from 'react-router-dom'

export function AlbumDetailPage() {
  const { albumId } = useParams<{ albumId: string }>()
  const formattedId = albumId?.replace(/-/g, ' ') ?? 'unknown record'

  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-orange">Dynamic route</p>
          <h1 className="font-display text-3xl text-denim">Album: {formattedId}</h1>
          <p className="text-sm text-navy/70">Pull album data from the API using the slug or id in the URL.</p>
        </div>
        <Link
          to="/albums/rumours"
          className="rounded-pill border border-orange/60 bg-orange px-4 py-2 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
        >
          Try sample album
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-2xl border border-navy/10 bg-white/80 p-5 shadow-card">
          <p className="text-sm uppercase tracking-[0.14em] text-orange">Id / slug</p>
          <p className="font-display text-2xl text-denim">{albumId}</p>
          <p className="mt-2 text-sm text-navy/70">
            This is a placeholder. Replace with a fetch/useLoaderData hook that calls your backend with the id or slug
            found in the params.
          </p>
        </div>

        <div className="rounded-2xl border border-navy/10 bg-white/80 p-5 shadow-card">
          <p className="text-sm font-semibold text-denim">Pattern</p>
          <p className="text-sm text-navy/70">
            This route proves the router is configured for dynamic params. Inject your data layer and hydrate the view
            with album metadata, track list, and pricing.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-navy">
            <span className="rounded-pill bg-sun px-3 py-1">Loader ready</span>
            <span className="rounded-pill border border-orange/50 bg-orange/20 px-3 py-1">Slug friendly</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-navy/10 bg-white/70 p-5 shadow-inner">
        <p className="font-semibold text-denim">Navigation</p>
        <p className="text-sm text-navy/70">
          Wire this up to a list page that links to <code className="font-mono">/albums/:albumId</code> so you can pass
          ids from cards, tables, or search results.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            to="/"
            className="rounded-pill border border-navy/10 bg-cream px-4 py-2 text-sm font-semibold text-navy shadow-sm transition hover:-translate-y-0.5 hover:border-orange"
          >
            Back to design system
          </Link>
          <Link
            to="/dashboard"
            className="rounded-pill border border-navy/10 bg-navy px-4 py-2 text-sm font-semibold text-cream shadow-panel transition hover:-translate-y-0.5 hover:bg-denim"
          >
            Go to dashboard (auth)
          </Link>
        </div>
      </div>
    </section>
  )
}

export default AlbumDetailPage
