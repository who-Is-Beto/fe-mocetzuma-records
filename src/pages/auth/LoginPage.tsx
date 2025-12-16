import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'

export function LoginPage() {
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard'

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">Auth route</p>
        <h1 className="font-display text-3xl text-denim">Sign in placeholder</h1>
        <p className="text-sm text-navy/70">
          Plug your token exchange here. The login helper below simply sets a demo token so you can hit protected
          routes while you wire up the real flow.
        </p>
      </header>

      <div className="rounded-2xl border border-navy/10 bg-white/80 p-5 shadow-card">
        <p className="text-sm text-navy/80">
          When you&apos;re ready, replace <span className="font-mono">login(&apos;demo-token&apos;)</span> with your token issuer
          and persist the token however you prefer.
        </p>
        <button
          type="button"
          onClick={() => login('demo-token')}
          className="mt-4 inline-flex items-center gap-2 rounded-pill border border-orange/60 bg-orange px-4 py-2 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange"
        >
          <span>🚀</span>
          Mock login
        </button>
      </div>

      <p className="text-sm text-navy/70">
        After login you will be redirected to: <span className="font-semibold text-denim">{from}</span>
      </p>
    </section>
  )
}

export default LoginPage
