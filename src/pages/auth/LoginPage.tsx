import { FormEvent, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useAuth } from '../../app/providers/AuthProvider'
import { HttpError } from '../../app/lib/httpClient'

export function LoginPage() {
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/perfil'

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!email || !password) {
      setError('Ingresa tu correo y contraseña para continuar.')
      return
    }

    setError(null)
    setIsSubmitting(true)
    login({ email, password }).catch((err: unknown) => {
      if (err instanceof HttpError) {
        const message = typeof err.data === 'string' && err.data.trim().length > 0 ? err.data : err.message
        setError(message)
      } else {
        setError('No pudimos iniciar sesión. Intenta de nuevo.')
      }
    }).finally(() => setIsSubmitting(false))
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">Acceso</p>
        <h1 className="font-display text-3xl text-denim">Inicia sesión</h1>
        <p className="text-sm text-navy/70">
          Usa tu correo para acceder a tu perfil y mantener tu sesión activa en este dispositivo.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-navy/10 bg-white/80 p-5 shadow-card">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-[0.16em] text-orange">Correo</label>
          <div className="flex items-center gap-3 rounded-xl border border-navy/15 bg-cream px-3 py-2 focus-within:border-orange">
            <span className="text-lg">📧</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
              placeholder="tu@email.com"
              type="email"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-[0.16em] text-orange">Contraseña</label>
          <div className="flex items-center gap-3 rounded-xl border border-navy/15 bg-cream px-3 py-2 focus-within:border-orange">
            <span className="text-lg">🔒</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
              placeholder="••••••••"
              type="password"
              minLength={6}
              required
            />
          </div>
        </div>

        {error ? <p className="text-sm font-semibold text-coral">{error}</p> : null}

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            tone="orange"
            className="w-full justify-center px-4 py-3 text-base disabled:opacity-70"
            disabled={isSubmitting}
          >
            <span>🎵</span>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
          <span className="text-xs uppercase tracking-[0.14em] text-navy/60">Sesión segura en este navegador</span>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-navy/10 bg-cream px-3 py-3 text-sm text-navy shadow-inner md:hidden">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-[0.16em] text-orange">¿Nuevo aquí?</p>
            <p className="text-[11px] text-navy/70 leading-tight">Activa tu cuenta y guarda sesión.</p>
          </div>
          <Link
            to="/register"
            className="w-full rounded-pill border border-orange/70 bg-orange px-3 py-2 text-center text-xs font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
          >
            Registrarme
          </Link>
        </div>
      </form>

      <div className="hidden flex-wrap items-center gap-3 rounded-2xl border border-navy/10 bg-white/70 px-4 py-3 text-sm text-navy/80 shadow-inner md:flex">
        <p>
          Después de iniciar sesión serás redirigido a{' '}
          <span className="font-semibold text-denim">{from}</span>
        </p>
        <span className="hidden text-orange md:inline">·</span>
        <Link to="/register" className="font-semibold text-orange hover:text-coral">
          Crear cuenta
        </Link>
      </div>
    </section>
  )
}

export default LoginPage
