import type { AuthTokensResponse } from './types'

/** RFC 7807 problem details returned by the API. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {},
  ) {
    super(message)
  }

  /** First validation message for a field, if any (field names are camelCase). */
  field(name: string): string | undefined {
    return this.errors[name]?.[0]
  }
}

type Body = unknown

/**
 * Small fetch wrapper:
 * - keeps the short-lived access token in memory only
 * - persists the refresh token (rotated on every use) so the session survives reloads
 * - transparently refreshes once on 401
 */
export class ApiClient {
  private accessToken: string | null = null
  private refreshing: Promise<AuthTokensResponse | null> | null = null
  onSessionExpired: (() => void) | null = null

  constructor(
    private readonly baseUrl: string,
    private readonly storageKey: string,
    /** Transport — swapped for the in-browser demo backend on GitHub Pages. */
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}

  get refreshToken(): string | null {
    try {
      return localStorage.getItem(this.storageKey)
    } catch {
      return null
    }
  }

  setTokens(tokens: AuthTokensResponse | null) {
    this.accessToken = tokens?.accessToken ?? null
    try {
      if (tokens) localStorage.setItem(this.storageKey, tokens.refreshToken)
      else localStorage.removeItem(this.storageKey)
    } catch {
      /* storage unavailable (private mode) — session lasts until reload */
    }
  }

  /**
   * Exchanges the stored refresh token for a fresh session. Concurrent callers share one request,
   * because refresh tokens are single-use (rotation) and a parallel second use looks like theft.
   */
  refresh(): Promise<AuthTokensResponse | null> {
    this.refreshing ??= this.doRefresh().finally(() => (this.refreshing = null))
    return this.refreshing
  }

  private async doRefresh(): Promise<AuthTokensResponse | null> {
    const token = this.refreshToken
    if (!token) return null
    const res = await this.fetcher(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    })
    if (!res.ok) {
      this.setTokens(null)
      return null
    }
    const tokens = (await res.json()) as AuthTokensResponse
    this.setTokens(tokens)
    return tokens
  }

  get<T>(path: string) {
    return this.request<T>('GET', path)
  }
  post<T = void>(path: string, body?: Body) {
    return this.request<T>('POST', path, body)
  }
  put<T = void>(path: string, body?: Body) {
    return this.request<T>('PUT', path, body)
  }
  patch<T = void>(path: string, body?: Body) {
    return this.request<T>('PATCH', path, body)
  }
  delete<T = void>(path: string) {
    return this.request<T>('DELETE', path)
  }

  /** Downloads a binary resource (PDFs, documents) with authentication. */
  async blob(path: string): Promise<Blob> {
    const res = await this.send('GET', path)
    if (!res.ok) throw await toError(res)
    return res.blob()
  }

  async request<T>(method: string, path: string, body?: Body): Promise<T> {
    const res = await this.send(method, path, body)
    if (!res.ok) throw await toError(res)
    if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T
    const type = res.headers.get('content-type') ?? ''
    return (type.includes('json') ? await res.json() : undefined) as T
  }

  private async send(method: string, path: string, body?: Body, retried = false): Promise<Response> {
    const headers: Record<string, string> = {}
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`
    let payload: BodyInit | undefined
    if (body instanceof FormData) payload = body
    else if (body !== undefined) {
      headers['content-type'] = 'application/json'
      payload = JSON.stringify(body)
    }

    const res = await this.fetcher(`${this.baseUrl}${path}`, { method, headers, body: payload })
    if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
      if (await this.refresh()) return this.send(method, path, body, true)
      this.onSessionExpired?.()
    }
    return res
  }
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const problem = await res.json()
    return new ApiError(res.status, problem.title ?? res.statusText, problem.errors ?? {})
  } catch {
    const fallback = res.status === 429 ? 'Demasiados intentos. Espera un momento.' : 'No se pudo completar la solicitud.'
    return new ApiError(res.status, fallback)
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const first = Object.values(err.errors)[0]?.[0]
    return first ?? err.message
  }
  if (err instanceof TypeError) return 'Sin conexión con el servidor.'
  return 'Ocurrió un error inesperado.'
}
