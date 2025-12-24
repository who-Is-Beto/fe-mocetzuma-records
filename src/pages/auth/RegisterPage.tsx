import { FormEvent, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useAuth } from '../../app/providers/AuthProvider'
import { HttpError } from '../../app/lib/httpClient'

export function RegisterPage() {
  const location = useLocation()
  const { register, isAuthenticated } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/perfil'

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!username.trim()) {
      setError('Agrega un usuario para personalizar tu cuenta.')
      return
    }

    if (!email || !password || !confirmPassword) {
      setError('Completa todos los campos para continuar.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setError(null)
    setIsSubmitting(true)
    register({ username: username.trim(), email, password })
      .catch((err: unknown) => {
        if (err instanceof HttpError) {
          const message = typeof err.data === 'string' && err.data.trim().length > 0 ? err.data : err.message
          setError(message)
        } else {
          setError('No pudimos crear tu cuenta. Intenta de nuevo.')
        }
      })
      .finally(() => setIsSubmitting(false))
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">Registro</p>
        <h1 className="font-display text-3xl text-denim">Crea tu cuenta</h1>
        <p className="text-sm text-navy/70">
          Activa tu perfil y mantén la sesión en este navegador con un token guardado en sessionStorage.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-navy/10 bg-white/80 p-5 shadow-card">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-[0.16em] text-orange">Usuario</label>
          <div className="flex items-center gap-3 rounded-xl border border-navy/15 bg-cream px-3 py-2 focus-within:border-orange">
            <span className="text-lg">🎤</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
              placeholder="tu_usuario"
              type="text"
              required
            />
          </div>
        </div>

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

        <div className="grid gap-3 md:grid-cols-2">
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

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-[0.16em] text-orange">Repetir contraseña</label>
            <div className="flex items-center gap-3 rounded-xl border border-navy/15 bg-cream px-3 py-2 focus-within:border-orange">
              <span className="text-lg">✅</span>
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
                placeholder="••••••••"
                type="password"
                minLength={6}
                required
              />
            </div>
          </div>
        </div>

        {error ? <p className="text-sm font-semibold text-coral">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            tone="orange"
            className="px-4 py-2 text-sm disabled:opacity-70"
            disabled={isSubmitting}
          >
            <span>🚀</span>
            {isSubmitting ? 'Creando...' : 'Crear cuenta'}
          </Button>
          <span className="text-xs uppercase tracking-[0.14em] text-navy/60">
            Tu sesión se mantiene mientras el navegador esté abierto
          </span>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-navy/10 bg-white/70 px-4 py-3 text-sm text-navy/80 shadow-inner">
        <p>¿Ya tienes cuenta?</p>
        <Link to="/login" className="font-semibold text-orange hover:text-coral">
          Inicia sesión
        </Link>
      </div>
    </section>
  )
}

export default RegisterPage
