import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './auth'

export interface Resource<T> {
  data: T | undefined
  error: unknown
  loading: boolean
  reload(): Promise<void>
  setData(value: T): void
}

/** Fetches a GET endpoint and re-fetches when the path changes. Pass null to skip. */
export function useResource<T>(path: string | null): Resource<T> {
  const { api } = useAuth()
  const [data, setData] = useState<T>()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(path !== null)
  const latest = useRef(path)
  latest.current = path

  const load = useCallback(async () => {
    if (path === null) return
    setLoading(true)
    setError(undefined)
    try {
      const result = await api.get<T>(path)
      if (latest.current === path) setData(result)
    } catch (e) {
      if (latest.current === path) setError(e)
    } finally {
      if (latest.current === path) setLoading(false)
    }
  }, [api, path])

  useEffect(() => {
    void load()
  }, [load])

  return { data, error, loading, reload: load, setData }
}
