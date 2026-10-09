import { useEffect } from 'react'
import type { RefObject } from 'react'

/** Closes a popover on a click outside `ref` or on Escape. */
export function useDismiss(ref: RefObject<HTMLElement | null>, isOpen: boolean, close: () => void): void {
  useEffect(() => {
    if (!isOpen) return
    const outside = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', esc)
    }
  }, [ref, isOpen, close])
}
