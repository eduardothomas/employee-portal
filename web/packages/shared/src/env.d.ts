/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND?: 'api' | 'demo'
  readonly VITE_API_URL?: string
  readonly VITE_ROUTER?: 'hash' | 'browser'
}
