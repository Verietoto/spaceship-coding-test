// A value that follows another, but only once it has stopped changing for `ms` (typing in a search box must not fire a request per key).
import { useEffect, useState } from 'react'

export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return settled
}
