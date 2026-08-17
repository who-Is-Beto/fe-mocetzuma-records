import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { createAuthService } from '../../app/services/authService'
import { HttpError } from '../../app/lib/httpClient'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid') ?? ''
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const isLinkValid = Boolean(uid && token)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setFieldErrors({})

    if (!newPassword || !confirmPassword) {
      setError('Completa ambos campos de contraseña.')
      return
    }

    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirm_password: 'Las contraseñas no coinciden.' })
      return
    }

    setIsSubmitting(true)
    createAuthService()
      .confirmPasswordReset({ uid, token, new_password: newPassword, confirm_password: confirmPassword })
      .then(() => setSuccess(true))
      .catch((err: unknown) => {
        if (err instanceof HttpError && typeof err.data === 'object' && err.data !== null) {
          const data = err.data as Record<string, string | string[]>
          const newFieldErrors: Record<string, string> = {}
          let genericMessage = 'No pudimos restablecer tu contraseña.'

          for (const [key, value] of Object.entries(data)) {
            const msg = Array.isArray(value) ? value[0] : String(value)
            if (key === 'token') {
              genericMessage = msg
            } else {
              newFieldErrors[key] = msg
            }
          }

          if (Object.keys(newFieldErrors).length === 0) {
            setError(genericMessage)
          } else {
            setFieldErrors(newFieldErrors)
          }
        } else {
          setError('No pudimos restablecer tu contraseña. Intenta de nuevo.')
        }
      })
      .finally(() => setIsSubmitting(false))
  }

  if (!isLinkValid) {
    return (
      <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-orange">Seguridad</p>
          <h1 className="font-display text-3xl text-denim">Enlace inválido</h1>
        </header>
        <p className="text-sm text-navy/70">
          El enlace de recuperación es inválido o está incompleto. Solicita uno nuevo desde la página de inicio de sesión.
        </p>
        <Link
          to="/olvidaste-contrasena"
          className="inline-flex items-center justify-center gap-2 rounded-pill bg-orange px-4 py-2 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
        >
          Solicitar nuevo enlace
        </Link>
      </section>
    )
  }

  if (success) {
    return (
      <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 text-center shadow-panel backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-orange">Seguridad</p>
          <h1 className="font-display text-3xl text-denim">¡Contraseña actualizada!</h1>
        </header>
        <div className="text-4xl">✅</div>
        <p className="text-sm text-navy/70">
          Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center gap-2 rounded-pill bg-orange px-4 py-2 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
        >
          Iniciar sesión
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">Seguridad</p>
        <h1 className="font-display text-3xl text-denim">Restablece tu contraseña</h1>
        <p className="text-sm text-navy/70">
          Elige una contraseña nueva para tu cuenta. Asegúrate de que sea segura y fácil de recordar.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-navy/10 bg-white/80 p-5 shadow-card">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-[0.16em] text-orange">Nueva contraseña</label>
          <div className="flex items-center gap-3 rounded-xl border border-navy/15 bg-cream px-3 py-2 focus-within:border-orange">
            <span className="text-lg">🔒</span>
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
              placeholder="••••••••"
              type="password"
              minLength={8}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-[0.16em] text-orange">Confirmar contraseña</label>
          <div className="flex items-center gap-3 rounded-xl border border-navy/15 bg-cream px-3 py-2 focus-within:border-orange">
            <span className="text-lg">🔒</span>
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
              placeholder="••••••••"
              type="password"
              minLength={8}
              required
            />
          </div>
          {fieldErrors.confirm_password ? (
            <p className="text-xs font-semibold text-coral">{fieldErrors.confirm_password}</p>
          ) : null}
        </div>

        {error ? <p className="text-sm font-semibold text-coral">{error}</p> : null}

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            tone="orange"
            className="w-full justify-center px-4 py-3 text-base disabled:opacity-70"
            disabled={isSubmitting}
          >
            <span>🔐</span>
            {isSubmitting ? 'Guardando...' : 'Restablecer contraseña'}
          </Button>
        </div>
      </form>

      <div className="text-center text-sm text-navy/70">
        ¿Recordaste tu contraseña?{' '}
        <Link to="/login" className="font-semibold text-orange hover:text-coral">
          Iniciar sesión
        </Link>
      </div>
    </section>
  )
}

export default ResetPasswordPage
