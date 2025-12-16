import { Link } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'

export function DashboardPage() {
  const { logout, user } = useAuth()

  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-orange">Protected route</p>
          <h1 className="font-display text-3xl text-denim">Dashboard</h1>
          <p className="text-sm text-navy/70">Only visible when the auth guard lets you through.</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-pill border border-navy/10 bg-white/80 px-4 py-2 text-sm font-semibold text-navy shadow-sm transition hover:-translate-y-0.5 hover:border-orange"
        >
          Logout
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-navy/10 bg-white/90 p-5 shadow-card">
          <p className="text-sm font-semibold text-denim">Session placeholder</p>
          <p className="text-sm text-navy/70">
            Swap this mock user with your token payload. The guard uses <code className="font-mono">isAuthenticated</code>
            to allow entry.
          </p>
          <div className="mt-3 rounded-xl border border-navy/10 bg-cream/60 p-4 text-sm text-navy">
            <p className="font-semibold text-denim">User</p>
            <p>{user?.name ?? 'Anonymous'}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-navy/10 bg-white/90 p-5 shadow-card">
          <p className="text-sm font-semibold text-denim">Next steps</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy/80">
            <li>Replace the mock login with your token exchange.</li>
            <li>Persist the token (cookie, localStorage, secure storage).</li>
            <li>Hydrate <code className="font-mono">AuthProvider</code> from the persisted state.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/"
              className="rounded-pill border border-navy/10 bg-cream px-4 py-2 text-sm font-semibold text-navy shadow-sm transition hover:-translate-y-0.5 hover:border-orange"
            >
              Back home
            </Link>
            <Link
              to="/albums/rumours"
              className="rounded-pill border border-orange/60 bg-orange px-4 py-2 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
            >
              Demo dynamic route
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DashboardPage
