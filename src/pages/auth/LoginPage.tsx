import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useAuth } from '../../app/providers/AuthProvider'
import { createAuthService } from '../../app/services/authService'
import { HttpError, extractErrorMessage } from '../../app/lib/httpClient'
import { useSeo } from "../../app/hooks/useSeo";
import { T } from '../../app/i18n/strings'

export function LoginPage() {
  useSeo({ title: T.auth.login.pageTitle, noindex: true });
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/perfil'

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const handleResend = () => {
    setResendMessage(null)
    createAuthService()
      .resendVerification({ email })
      .then(() => setResendMessage(T.auth.login.resendSuccess))
      .catch(() => setResendMessage(T.auth.login.resendError))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!email || !password) {
      setError(T.auth.login.errorFillFields)
      return
    }

    setError(null)
    setNeedsVerification(false)
    setIsSubmitting(true)
    login({ email, password }).catch((err: unknown) => {
      if (err instanceof HttpError && err.status === 403) {
        const data = err.data as { error?: { code?: string; message?: string } } | undefined
        if (data?.error?.code === 'email_not_verified') {
          setNeedsVerification(true)
          setError(data.error.message ?? T.auth.login.verifyEmailToLogin)
          return
        }
      }
      if (err instanceof HttpError) {
        setError(extractErrorMessage(err.data, err.message))
      } else {
        setError(T.auth.login.errorGeneric)
      }
    }).finally(() => setIsSubmitting(false))
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">Acceso</p>
        <h1 className="font-display text-3xl text-denim">{T.auth.login.title}</h1>
        <p className="text-sm text-navy/70">
          {T.auth.login.subtitle}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-navy/10 bg-white/80 p-5 shadow-card">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-[0.16em] text-orange">{T.auth.login.email}</label>
          <div className="flex items-center gap-3 rounded-xl border border-navy/15 bg-cream px-3 py-2 focus-within:border-orange">
            <span className="text-lg">📧</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
              placeholder={T.auth.login.emailPlaceholder}
              type="email"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-[0.16em] text-orange">{T.auth.login.password}</label>
          <div className="flex items-center gap-3 rounded-xl border border-navy/15 bg-cream px-3 py-2 focus-within:border-orange">
            <span className="text-lg">🔒</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
              placeholder={T.auth.login.passwordPlaceholder}
              type="password"
              minLength={6}
              required
            />
          </div>
          <div className="text-right">
            <Link
              to="/olvidaste-contrasena"
              className="text-xs font-semibold text-orange hover:text-coral"
            >
              {T.auth.login.forgotPassword}
            </Link>
          </div>
        </div>

        {error ? <p className="text-sm font-semibold text-coral">{error}</p> : null}

        {needsVerification ? (
          <div className="flex flex-col gap-2 rounded-xl border border-orange/40 bg-orange/10 px-3 py-3 text-sm">
            <Button tone="outline" onClick={handleResend}>
              🔁 {T.auth.login.resendVerification}
            </Button>
            {resendMessage ? <p className="text-xs font-semibold text-navy/70">{resendMessage}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            tone="orange"
            className="w-full justify-center px-4 py-3 text-base disabled:opacity-70"
            disabled={isSubmitting}
          >
            <span>🎵</span>
            {isSubmitting ? T.auth.login.submitting : T.auth.login.submit}
          </Button>
          <span className="text-xs uppercase tracking-[0.14em] text-navy/60">{T.auth.login.secureNote}</span>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-navy/10 bg-cream px-3 py-3 text-sm text-navy shadow-inner md:hidden">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-[0.16em] text-orange">{T.auth.login.noAccountTitle}</p>
            <p className="text-[11px] text-navy/70 leading-tight">{T.auth.login.noAccountHint}</p>
          </div>
          <Link
            to="/register"
            className="w-full rounded-pill border border-orange/70 bg-orange px-3 py-2 text-center text-xs font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
          >
            {T.auth.login.createAccount}
          </Link>
        </div>
      </form>

      <div className="hidden flex-wrap items-center gap-3 rounded-2xl border border-navy/10 bg-white/70 px-4 py-3 text-sm text-navy/80 shadow-inner md:flex">
        <p>
          {T.auth.login.redirectNote}{' '}
          <span className="font-semibold text-denim">{from}</span>
        </p>
        <span className="hidden text-orange md:inline">·</span>
        <Link to="/register" className="font-semibold text-orange hover:text-coral">
          {T.auth.login.goToRegister}
        </Link>
      </div>
    </section>
  )
}

export default LoginPage
