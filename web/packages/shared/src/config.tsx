import type { ReactNode } from 'react'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { ApiClient } from './api'
import { createDemoFetch } from './demo/server'

/**
 * Runtime configuration for both apps, read from the Vite env files in `web/`
 * (`.env` for `npm run dev`, `.env.production` for builds). In GitHub Actions the same
 * variables come from repository variables and override the files.
 *
 *   VITE_BACKEND = "api"  → talk to the real ASP.NET Core API at VITE_API_URL
 *                  "demo" → in-browser simulated backend (no server needed, data per browser)
 */
export type BackendMode = 'api' | 'demo'

export const BACKEND: BackendMode = import.meta.env.VITE_BACKEND === 'demo' ? 'demo' : 'api'
export const IS_DEMO = BACKEND === 'demo'
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')

const DEMO_PREFIX = '/demo-api'

/** One API client per app; the transport depends on the backend mode. */
export function createApiClient(storageKey: string): ApiClient {
  return IS_DEMO
    ? new ApiClient(DEMO_PREFIX, storageKey, createDemoFetch(DEMO_PREFIX))
    : new ApiClient(API_URL, storageKey)
}

/** Prefixes a file from `public/` with the deploy base path (e.g. "/employee-portal/"). */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

/** Hash routing for static hosts without SPA fallback (GitHub Pages); history routing otherwise. */
export function AppRouter({ children }: { children: ReactNode }) {
  return import.meta.env.VITE_ROUTER === 'hash'
    ? <HashRouter>{children}</HashRouter>
    : <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>{children}</BrowserRouter>
}
