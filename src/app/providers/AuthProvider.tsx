import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Credentials, RegisterInput } from '../domain/auth'
import { createAuthService } from '../services/authService'

type StoredAuth = {
  token: string
  refreshToken?: string | null
  user: AuthUser
}

type AuthState = {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
}

type AuthUser = {
  name: string
  email?: string
}

type AuthContextValue = {
  isAuthenticated: boolean
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  login: (credentials: Credentials) => Promise<void>
  register: (payload: RegisterInput) => Promise<void>
  logout: () => void
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
  if (typeof window === 'undefined') return { token: null, refreshToken: null, user: null }

  const stored = safeParse(sessionStorage.getItem(SESSION_KEY))
  if (stored?.token) {
    return { token: stored.token, refreshToken: stored.refreshToken ?? null, user: stored.user }
  }

  return { token: null, refreshToken: null, user: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => getInitialAuthState())
  const authService = useMemo(() => createAuthService(), [])

  const setSession = useCallback((token: string, refreshToken: string | null, user: AuthUser) => {
    setAuthState({ token, refreshToken, user })
  }, [])

  const login = useCallback(
    async (credentials: Credentials) => {
      const response = await authService.login(credentials)
      const user =
        response.user ??
        ({
          name: credentials.email.split('@')[0] || 'Usuario',
          email: credentials.email
        } satisfies AuthUser)

      setSession(response.accessToken, response.refreshToken ?? null, user)
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
          email: payload.email
        } satisfies AuthUser)

      setSession(response.accessToken, response.refreshToken ?? null, user)
    },
    [authService, setSession],
  )

  const logout = useCallback(() => {
    setAuthState({ token: null, refreshToken: null, user: null })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (authState.token) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          token: authState.token,
          refreshToken: authState.refreshToken,
          user: authState.user
        }),
      )
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [authState])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(authState.token),
      token: authState.token,
      refreshToken: authState.refreshToken,
      user: authState.user,
      login,
      register,
      logout,
    }),
    [authState, login, logout, register],
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
