// A label that explains itself (a button, so the keyboard can reach it): a help cursor and a dotted underline, and on hover or keyboard focus a tooltip with the text.
// (The browser's own title tooltip waits a second, cannot be styled and does not appear on keyboard focus.)
import { useId } from 'react'
import type { ReactNode } from 'react'

export function Hint({ text, children }: { text: string; children: ReactNode }) {
  const id = useId()
  return (
    <button type="button" className="hint" aria-describedby={id}>
      {children}
      <span role="tooltip" id={id} className="hint-tip">{text}</span>
    </button>
  )
}
