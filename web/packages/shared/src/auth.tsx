import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiClient } from './api'
import type { AuthTokensResponse, LoginResponse, UserSummary } from './types'

export type AuthStatus = 'loading' | 'anonymous' | 'locked' | 'authenticated'

interface AuthContextValue {
  status: AuthStatus
  user: UserSummary | null
  challenge: LoginResponse | null
  api: ApiClient
  login(login: string, password: string): Promise<LoginResponse>
  verifyMfa(code: string): Promise<AuthTokensResponse>
  /** Resumes a stored session after the app-specific lock (e.g. Face ID) succeeds. */
  unlock(): Promise<boolean>
  logout(): Promise<void>
  setUser(user: UserSummary): void
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface Props {
  api: ApiClient
  /** Return true to require an unlock step before restoring a remembered session. */
  shouldLock?: () => boolean
  deviceName?: string
  children: ReactNode
}

export function AuthProvider({ api, shouldLock, deviceName, children }: Props) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<UserSummary | null>(null)
  const [challenge, setChallenge] = useState<LoginResponse | null>(null)

  const restore = useCallback(async () => {
    const tokens = await api.refresh().catch(() => null)
    setUser(tokens?.user ?? null)
    setStatus(tokens ? 'authenticated' : 'anonymous')
    return !!tokens
  }, [api])

  useEffect(() => {
    api.onSessionExpired = () => {
      api.setTokens(null)
      setUser(null)
      setStatus('anonymous')
    }
    if (!api.refreshToken) setStatus('anonymous')
    else if (shouldLock?.()) setStatus('locked')
    else void restore()
  }, [api, restore, shouldLock])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      challenge,
      api,
      async login(login, password) {
        const res = await api.post<LoginResponse>('/auth/login', { login, password })
        setChallenge(res)
        return res
      },
      async verifyMfa(code) {
        if (!challenge) throw new Error('No hay verificación en curso.')
        const tokens = await api.post<AuthTokensResponse>('/auth/mfa/verify', {
          challengeId: challenge.challengeId,
          code,
          deviceName: deviceName ?? navigator.userAgent.slice(0, 120),
        })
        api.setTokens(tokens)
        setChallenge(null)
        setUser(tokens.user)
        setStatus('authenticated')
        return tokens
      },
      unlock: restore,
      async logout() {
        const token = api.refreshToken
        if (token) await api.post('/auth/logout', { refreshToken: token }).catch(() => undefined)
        api.setTokens(null)
        setUser(null)
        setStatus('anonymous')
      },
      setUser,
    }),
    [status, user, challenge, api, deviceName, restore],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
