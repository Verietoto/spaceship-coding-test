// Fetches `/api/<path>` whenever path/params change; keeps the previous data while reloading (no flicker).
import { useEffect, useState } from 'react'
import { Unauthorized, apiUrl } from '../lib/api'
import type { Params } from '../lib/api'
import { useApp } from './useApp'

export function useApi<T>(path: string, params: Params = {}): { data?: T; error?: string; isLoading: boolean } {
  const { onUnauthorized } = useApp()
  const key = apiUrl(path, params)
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' })

  useEffect(() => {
    let live = true
    fetch(key)
      .then(async (r) => {
        if (r.status === 401) throw new Unauthorized()
        if (!r.ok) throw new Error(r.statusText)
        return (await r.json()) as T
      })
      .then(
        (data) => live && setState({ key, data }),
        (e: unknown) => {
          if (e instanceof Unauthorized) onUnauthorized()
          else if (live) setState((s) => ({ ...s, key, error: e instanceof Error ? e.message : String(e) }))
        },
      )
    return () => {
      live = false
    }
  }, [key, onUnauthorized])

  return { data: state.data, error: state.key === key ? state.error : undefined, isLoading: state.key !== key }
}
