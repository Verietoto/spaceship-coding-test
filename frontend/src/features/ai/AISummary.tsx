// AI report summary for the active filters (numbers come from backend SQL; shown with its calc trace).
import { useState } from 'react'
import { useApp } from '../../app/useApp'
import { CalcTrace } from '../../components/CalcTrace'
import { GlowIcon } from '../../components/GlowIcon'
import { Icon } from '../../components/Icon'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { copilot as copilotMsg } from '../../i18n/copilot'
import { api, errorText, fq } from '../../lib/api'
import type { Calc } from '../../lib/types'

export function AISummary() {
  const { lang, view } = useApp()
  const t = useMessages(copilotMsg)
  const tc = useMessages(common)
  const [state, setState] = useState<{ summary?: string; calc?: Calc; error?: string; isBusy?: boolean }>({})

  const run = async () => {
    setState({ isBusy: true })
    try {
      const r = await api<{ summary: string; calc: Calc }>('summary', { ...fq(view.f), lang })
      setState({ summary: r.summary, calc: r.calc })
    } catch (e: unknown) {
      setState({ error: errorText(e) })
    }
  }

  // The model writes "- " bullet lines; show those as bullets and anything else as a paragraph.
  const lines = (state.summary ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const mailto = state.summary ? `mailto:?subject=${encodeURIComponent(t('summary_subject'))}&body=${encodeURIComponent(state.summary)}` : undefined

  return (
    <section className="card ai glow-host">
      <div className="card-head">
        <div className="card-title">
          <GlowIcon name="sparkle" tone="ai" breathe={state.isBusy} />
          <div>
            <span className="lab ai">{t('summary')}</span>
            <p>{t('summary_sub')}</p>
          </div>
        </div>
        <div className="card-actions">
          {mailto && (
            <a className="btn ghost" href={mailto}>
              <Icon name="mail" size={16} /> {t('summary_send')}
            </a>
          )}
          <button type="button" className="btn primary" onClick={() => void run()} disabled={state.isBusy}>
            <Icon name="sparkle" size={16} /> {state.isBusy ? tc('ai_thinking') : state.summary ? t('regenerate') : t('summary_btn')}
          </button>
        </div>
      </div>
      {state.error && <p className="note bad">{tc('ai_error')} {state.error}</p>}
      {lines.length > 0 && (
        <div className="bullets">
          {lines.map((l, i) => (l.startsWith('- ') ? <div key={i} className="bullet">{l.slice(2)}</div> : <p key={i} style={{ fontWeight: 600 }}>{l}</p>))}
        </div>
      )}
      {state.calc && <CalcTrace calc={state.calc} label={tc('ai_calc')} />}
    </section>
  )
}
