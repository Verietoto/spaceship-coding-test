import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { useMessages } from '../../i18n'
import { copilot as copilotMsg } from '../../i18n/copilot'
import { PREFILL_ASK } from '../../lib/prefill'
import type { Copilot } from './useCopilot'

/** Pill input with a round send button; `compact` is the Copilot panel's variant. */
export function AskForm({ copilot, placeholder, compact }: { copilot: Copilot; placeholder: string; compact?: boolean }) {
  const t = useMessages(copilotMsg)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  // Someone (the tour) suggests a question: put it in the main command bar and focus it, but leave sending to the user.
  useEffect(() => {
    if (compact) return
    const fill = (e: Event) => {
      setText(String((e as CustomEvent<string>).detail ?? ''))
      input.current?.focus()
    }
    window.addEventListener(PREFILL_ASK, fill)
    return () => window.removeEventListener(PREFILL_ASK, fill)
  }, [compact])
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (!q || copilot.isBusy) return
    setText('')
    void copilot.ask(q)
  }
  return (
    <form className={`ask${compact ? ' compact' : ''}`} onSubmit={handleSubmit} role="search" data-tour={compact ? undefined : 'ask'}>
      {!compact && <Icon name="sparkle" size={18} />}
      <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={2000} />
      <button type="submit" className="icon-btn round" aria-label={t('send')} disabled={copilot.isBusy || !text.trim()}>
        <Icon name="send" size={16} />
      </button>
    </form>
  )
}
