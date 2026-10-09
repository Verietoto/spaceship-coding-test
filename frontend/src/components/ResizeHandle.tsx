// A vertical drag handle between the main column and the Copilot panel (it sits left of the panel, so dragging left widens it).
// Pointer drag, arrow keys, and double-click to reset.
import { useEffect, useRef } from 'react'

type Props = { value: number; min: number; max: number; label: string; onChange: (w: number, final?: boolean) => void; onReset: () => void }

export function ResizeHandle({ value, min, max, label, onChange, onReset }: Props) {
  const drag = useRef<{ x: number; w: number; last: number } | null>(null)
  useEffect(() => () => document.body.classList.remove('resizing'), []) // unmounted mid-drag: do not leave the page unselectable
  const end = () => {
    if (!drag.current) return
    onChange(drag.current.last, true)
    drag.current = null
    document.body.classList.remove('resizing')
  }

  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, w: value, last: value }
        document.body.classList.add('resizing')
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        drag.current.last = drag.current.w - (e.clientX - drag.current.x)
        onChange(drag.current.last)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        e.preventDefault()
        onChange(value + (e.key === 'ArrowLeft' ? 24 : -24), true)
      }}
    />
  )
}
