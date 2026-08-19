import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { createAuthService } from '../../app/services/authService'
import { HttpError, extractErrorMessage } from '../../app/lib/httpClient'
import { T } from '../../app/i18n/strings'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!email) {
      setError(T.auth.forgotPassword.errorFillEmail)
      return
    }

    setError(null)
    setIsSubmitting(true)
    createAuthService()
      .requestPasswordReset({ email })
      .then(() => setSent(true))
      .catch((err: unknown) => {
        if (err instanceof HttpError) {
          setError(extractErrorMessage(err.data, T.auth.forgotPassword.errorGeneric))
        } else {
          setError(T.auth.forgotPassword.errorGeneric)
        }
      })
      .finally(() => setIsSubmitting(false))
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">{T.auth.forgotPassword.securityBadge}</p>
        <h1 className="font-display text-3xl text-denim">{T.auth.forgotPassword.title}</h1>
        <p className="text-sm text-navy/70">
          {T.auth.forgotPassword.subtitle}
        </p>
      </header>

      {sent ? (
        <div className="space-y-4 rounded-2xl border border-navy/10 bg-white/80 p-5 shadow-card text-center">
          <div className="text-4xl">📬</div>
          <h2 className="font-display text-xl text-denim">{T.auth.forgotPassword.successTitle}</h2>
          <p className="text-sm text-navy/70">
            {T.auth.forgotPassword.successNote.split("{email}")[0]}
            <span className="font-semibold text-navy">{email}</span>
            {T.auth.forgotPassword.successNote.split("{email}")[1]}
          </p>
          <p className="text-xs text-navy/50">
            {T.auth.forgotPassword.successExpiry}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-pill bg-orange px-4 py-2 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
            >
              {T.auth.forgotPassword.backToLogin}
            </Link>
            <Button tone="outline" onClick={() => { setSent(false); setEmail('') }}>
              {T.auth.forgotPassword.sendToOther}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-navy/10 bg-white/80 p-5 shadow-card">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-[0.16em] text-orange">{T.auth.forgotPassword.email}</label>
            <div className="flex items-center gap-3 rounded-xl border border-navy/15 bg-cream px-3 py-2 focus-within:border-orange">
              <span className="text-lg">📧</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
                placeholder={T.auth.forgotPassword.emailPlaceholder}
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
              {isSubmitting ? T.auth.forgotPassword.submitting : T.auth.forgotPassword.submit}
            </Button>
          </div>
        </form>
      )}

      <div className="text-center text-sm text-navy/70">
        {T.auth.forgotPassword.rememberPassword}{' '}
        <Link to="/login" className="font-semibold text-orange hover:text-coral">
          {T.auth.forgotPassword.goToLogin}
        </Link>
      </div>
    </section>
  )
}

export default ForgotPasswordPage
