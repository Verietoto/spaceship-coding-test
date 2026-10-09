// AI explanation of an order / data issue, from facts the backend already computed.
import { useState } from 'react'
import { useApp } from '../../app/useApp'
import { Icon } from '../../components/Icon'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { api, errorText } from '../../lib/api'

export function AIExplain({ facts, fallback }: { facts: string; fallback?: string }) {
  const { lang } = useApp()
  const tc = useMessages(common)
  const [state, setState] = useState<{ facts: string; text?: string; error?: string; isBusy?: boolean }>({ facts: '' })
  const current = state.facts === facts ? state : { facts }

  const run = async () => {
    setState({ facts, isBusy: true })
    try {
      const r = await api<{ text: string }>('explain', {}, { facts, lang })
      setState({ facts, text: r.text })
    } catch (e: unknown) {
      setState({ facts, error: errorText(e) })
    }
  }

  return (
    <div className="ai-explain">
      {current.text ? (
        <p className="ai-text">
          <span className="ai-pill">{tc('ai_tag')}</span> {current.text}
        </p>
      ) : (
        fallback && <p>{fallback}</p>
      )}
      {current.error && <p className="note bad small">{tc('ai_error')} {current.error}</p>}
      {!current.text && (
        <button type="button" className="btn ghost" onClick={() => void run()} disabled={current.isBusy}>
          <Icon name="sparkle" size={14} /> {current.isBusy ? tc('ai_thinking') : tc('ai_explain')}
        </button>
      )}
    </div>
  )
}
