import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { createAuthService } from '../../app/services/authService'
import { HttpError } from '../../app/lib/httpClient'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!email) {
      setError('Ingresa tu correo electrónico para continuar.')
      return
    }

    setError(null)
    setIsSubmitting(true)
    createAuthService()
      .requestPasswordReset({ email })
      .then(() => setSent(true))
      .catch((err: unknown) => {
        if (err instanceof HttpError) {
          const message = typeof err.data === 'string' && err.data.trim().length > 0
            ? err.data
            : 'No pudimos enviar el enlace. Intenta de nuevo.'
          setError(message)
        } else {
          setError('No pudimos enviar el enlace. Intenta de nuevo.')
        }
      })
      .finally(() => setIsSubmitting(false))
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">Seguridad</p>
        <h1 className="font-display text-3xl text-denim">¿Olvidaste tu contraseña?</h1>
        <p className="text-sm text-navy/70">
          No te preocupes. Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </header>

      {sent ? (
        <div className="space-y-4 rounded-2xl border border-navy/10 bg-white/80 p-5 shadow-card text-center">
          <div className="text-4xl">📬</div>
          <h2 className="font-display text-xl text-denim">Revisa tu correo</h2>
          <p className="text-sm text-navy/70">
            Si existe una cuenta con <span className="font-semibold text-navy">{email}</span>,
            recibirás un enlace para restablecer tu contraseña.
          </p>
          <p className="text-xs text-navy/50">
            El enlace expira en 24 horas. No olvides revisar tu carpeta de spam.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-pill bg-orange px-4 py-2 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
            >
              Volver al inicio de sesión
            </Link>
            <Button tone="outline" onClick={() => { setSent(false); setEmail('') }}>
              Enviar a otro correo
            </Button>
          </div>
        </div>
      ) : (
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

          {error ? <p className="text-sm font-semibold text-coral">{error}</p> : null}

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              tone="orange"
              className="w-full justify-center px-4 py-3 text-base disabled:opacity-70"
              disabled={isSubmitting}
            >
              <span>🔗</span>
              {isSubmitting ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </Button>
          </div>
        </form>
      )}

      <div className="text-center text-sm text-navy/70">
        ¿Recordaste tu contraseña?{' '}
        <Link to="/login" className="font-semibold text-orange hover:text-coral">
          Iniciar sesión
        </Link>
      </div>
    </section>
  )
}

export default ForgotPasswordPage
