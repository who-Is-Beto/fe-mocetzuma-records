import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type AuthState = {
  token: string | null
  user: { name: string } | null
}

type AuthContextValue = {
  isAuthenticated: boolean
  token: string | null
  user: { name: string } | null
  login: (token: string, user?: { name: string }) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ token: null, user: null })

  const login = useCallback((token: string, user = { name: 'Demo user' }) => {
    setAuthState({ token, user })
  }, [])

  const logout = useCallback(() => {
    setAuthState({ token: null, user: null })
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(authState.token),
      token: authState.token,
      user: authState.user,
      login,
      logout,
    }),
    [authState, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
