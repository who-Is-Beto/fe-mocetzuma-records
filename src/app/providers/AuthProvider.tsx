import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Credentials, RegisterInput } from '../domain/auth'
import { createAuthService } from '../services/authService'

type StoredAuth = {
  token: string
  refreshToken?: string | null
  user: AuthUser
  emailVerified?: boolean | null
}

type AuthState = {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  emailVerified: boolean | null
}

type AuthUser = {
  name: string
  email?: string
  role?: 'ADMIN' | 'CUSTOMER'
}

type AuthContextValue = {
  isAuthenticated: boolean
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  emailVerified: boolean | null
  role: 'ADMIN' | 'CUSTOMER' | null
  login: (credentials: Credentials) => Promise<void>
  register: (payload: RegisterInput) => Promise<void>
  logout: () => void
  markEmailVerified: () => void
  resendVerification: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const SESSION_KEY = 'moctezuma-session'

const safeParse = (value: string | null): StoredAuth | null => {
  if (!value) return null
  try {
    return JSON.parse(value) as StoredAuth
  } catch {
    return null
  }
}

const getInitialAuthState = (): AuthState => {
  if (typeof window === 'undefined') {
    return { token: null, refreshToken: null, user: null, emailVerified: null }
  }

  // localStorage (not sessionStorage) so the session survives browser
  // restarts AND is shared across tabs — otherwise verifying the email in the
  // tab opened from the link never updates the tab where the user registered.
  const stored = safeParse(localStorage.getItem(SESSION_KEY))
  if (stored?.token) {
    return {
      token: stored.token,
      refreshToken: stored.refreshToken ?? null,
      user: stored.user,
      emailVerified: stored.emailVerified ?? null,
    }
  }

  return { token: null, refreshToken: null, user: null, emailVerified: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => getInitialAuthState())
  const authService = useMemo(() => createAuthService(), [])

  // Keep this tab in sync when the session changes in another tab
  // (e.g. the email link opens a new tab and verification succeeds there).
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_KEY) return
      const stored = safeParse(event.newValue)
      if (stored?.token) {
        setAuthState({
          token: stored.token,
          refreshToken: stored.refreshToken ?? null,
          user: stored.user,
          emailVerified: stored.emailVerified ?? null,
        })
      } else {
        setAuthState({ token: null, refreshToken: null, user: null, emailVerified: null })
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Re-sync the authoritative email_verified status (and profile) from the
  // backend whenever we have a session — this fixes sessions created before
  // the email-verification feature (emailVerified === null) and any stale
  // state after verifying in another tab.
  useEffect(() => {
    if (!authState.token) return
    let cancelled = false

    authService
      .getProfile(authState.token)
      .then((profile) => {
        if (cancelled) return
        setAuthState((prev) => {
          if (!prev.token) return prev
          return {
            ...prev,
            user: { name: profile.name, email: profile.email, role: profile.role },
            // Never downgrade a just-verified `true` with a stale profile
            // response fetched before verification completed.
            emailVerified:
              prev.emailVerified === true
                ? true
                : profile.emailVerified ?? prev.emailVerified,
          }
        })
      })
      .catch(() => {
        // Token missing/expired or backend unreachable — keep the session as-is.
      })

    return () => {
      cancelled = true
    }
  }, [authState.token, authService])

  const setSession = useCallback(
    (token: string, refreshToken: string | null, user: AuthUser, emailVerified: boolean | null) => {
      setAuthState({ token, refreshToken, user, emailVerified })
    },
    [],
  )

  const login = useCallback(
    async (credentials: Credentials) => {
      const response = await authService.login(credentials)
      const user =
        response.user ??
        ({
          name: credentials.email.split('@')[0] || 'Usuario',
          email: credentials.email,
          role: response.role
        } satisfies AuthUser)

      setSession(response.accessToken, response.refreshToken ?? null, user, response.emailVerified ?? null)
    },
    [authService, setSession],
  )

  const register = useCallback(
    async (payload: RegisterInput) => {
      const response = await authService.register(payload)
      const user =
        response.user ??
        ({
          name: payload.username,
          email: payload.email,
          role: response.role
        } satisfies AuthUser)

      setSession(response.accessToken, response.refreshToken ?? null, user, response.emailVerified ?? null)
    },
    [authService, setSession],
  )

  const logout = useCallback(() => {
    setAuthState({ token: null, refreshToken: null, user: null, emailVerified: null })
    // Drop the stored cart code too, so a different user signing in on this
    // browser never inherits the previous user's cart.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('moctezuma-cart-code')
    }
  }, [])

  const markEmailVerified = useCallback(() => {
    setAuthState((prev) => (prev.emailVerified ? prev : { ...prev, emailVerified: true }))
  }, [])

  const resendVerification = useCallback(
    async (email: string) => {
      await authService.resendVerification({ email })
    },
    [authService],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (authState.token) {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          token: authState.token,
          refreshToken: authState.refreshToken,
          user: authState.user,
          emailVerified: authState.emailVerified
        }),
      )
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
  }, [authState])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(authState.token),
      token: authState.token,
      refreshToken: authState.refreshToken,
      user: authState.user,
      emailVerified: authState.emailVerified,
      role: authState.user?.role ?? null,
      login,
      register,
      logout,
      markEmailVerified,
      resendVerification,
    }),
    [authState, login, logout, markEmailVerified, register, resendVerification],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
