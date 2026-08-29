import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { createAuthService } from '../../app/services/authService'
import { HttpError } from '../../app/lib/httpClient'
import { useAuth } from '../../app/providers/AuthProvider'
import { T } from '../../app/i18n/strings'

type VerifyStatus = 'verifying' | 'success' | 'error'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid') ?? ''
  const token = searchParams.get('token') ?? ''
  const invalidLink = !uid || !token
  // Derive the initial state from the URL instead of a mount effect, so a bad
  // link renders its error on first paint (no flash of "verifying").
  const [status, setStatus] = useState<VerifyStatus>(
    invalidLink ? 'error' : 'verifying'
  )
  const [message, setMessage] = useState(
    invalidLink ? T.auth.verifyEmail.invalidLinkMessage : ''
  )
  const { markEmailVerified } = useAuth()

  useEffect(() => {
    if (invalidLink) return
    let cancelled = false

    createAuthService()
      .verifyEmail({ uid, token })
      .then((res) => {
        if (cancelled) return
        setStatus(res.emailVerified ? 'success' : 'error')
        setMessage(res.message ?? '')
        if (res.emailVerified) {
          // Update the live session so cart/profile unlock immediately.
          markEmailVerified()
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        if (err instanceof HttpError) {
          // DRF serializer errors come as { token: ["Invalid or expired verification link"] }.
          // The only 400 this endpoint returns is the token error, so localize it.
          setMessage(T.auth.verifyEmail.invalidLinkMessage)
        } else {
          setMessage(T.auth.verifyEmail.errorGeneric)
        }
      })

    return () => {
      cancelled = true
    }
  }, [uid, token, markEmailVerified, invalidLink])

  const title =
    status === 'success'
      ? T.auth.verifyEmail.successTitle
      : status === 'verifying'
        ? T.auth.verifyEmail.verifying
        : T.auth.verifyEmail.errorGeneric

  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">Verificación</p>
        <h1 className="font-display text-3xl text-denim">{title}</h1>
      </header>

      <p className="text-sm text-navy/70">
        {status === 'verifying'
          ? 'Un momento, por favor.'
          : status === 'success'
            ? T.auth.verifyEmail.successMessage
            : message}
      </p>

      {status !== 'verifying' && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button tone="orange" onClick={() => (window.location.href = '/')}>
            Ir a la tienda
          </Button>
          {status === 'error' && (
            <Button tone="outline" onClick={() => window.history.back()}>
              Volver
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

export default VerifyEmailPage
