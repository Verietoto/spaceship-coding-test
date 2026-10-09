// Shared by the features that write (knowledge notes, backoffice). Runs a write (add, delete, save): reloads what depends on `version`, and keeps the error to show.
import { useState } from 'react'
import { Unauthorized, errorText } from '../lib/api'
import { useApp } from './useApp'

export function useCall() {
  const { onUnauthorized } = useApp()
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const call = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      setVersion((v) => v + 1)
      return true
    } catch (e: unknown) {
      if (e instanceof Unauthorized) onUnauthorized()
      setError(errorText(e))
      return false
    }
  }
  return { version, error, call }
}
