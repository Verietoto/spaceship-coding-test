// B: the AI Copilot column: intro, suggestions, conversation (what it changed, Undo, charts, calc trace), input.
import { useEffect, useRef } from 'react'
import { useApp } from '../../app/useApp'
import { AgentActivity } from '../../components/AgentActivity'
import { CalcTrace } from '../../components/CalcTrace'
import { CopilotIllustration } from '../../components/CopilotIllustration'
import { DynamicChart } from '../../components/DynamicChart'
import { GlowIcon } from '../../components/GlowIcon'
import { Icon } from '../../components/Icon'
import { Markdown } from '../../components/Markdown'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { copilot as copilotMsg } from '../../i18n/copilot'
import { useFormat } from '../../i18n/format'
import { AskForm } from './AskForm'
import type { Change, Copilot } from './useCopilot'

const EXAMPLES = ['ex1', 'ex5', 'ex3', 'ex4', 'ex2'] as const

export function CopilotPanel({ copilot }: { copilot: Copilot }) {
  const { canUndo, undo } = useApp()
  const t = useMessages(copilotMsg)
  const tc = useMessages(common)
  const fmt = useFormat()
  const isEmpty = copilot.messages.length === 0
  const bodyRef = useRef<HTMLDivElement>(null)

  // the panel has a fixed height, so show the newest message as it arrives
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the effect reads nothing: it runs again on purpose whenever new content arrives
  }, [copilot.messages.length, copilot.isBusy, copilot.live.length])

  const value = (v: unknown): string => {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return t('all')
    if (Array.isArray(v)) return v.join(', ')
    if (typeof v === 'object') {
      const parts = Object.entries(v as Record<string, [number | null, number | null]>).map(([k, [lo, hi]]) => `${tc(`f_${k as 'value'}`)} ${lo ?? '…'}–${hi ?? '…'}`)
      return parts.length ? parts.join(', ') : t('all')
    }
    const s = String(v)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fmt.date(s)
    return s === 'prev' ? tc('cmp_prev') : s === 'base' ? tc('cmp_base') : s === 'none' ? tc('cmp_none') : s
  }
  const keyLabel = (k: Change['key']) =>
    k === 'start' ? t('k_start') : k === 'end' ? t('k_end') : k === 'exclude' ? t('k_exclude') : k === 'ranges' ? t('k_ranges') : k === 'arrived_start' ? t('k_arrived_start') : k === 'arrived_end' ? t('k_arrived_end') : tc(`f_${k}`)
  const changeLabel = (c: Change) => t('change', { k: keyLabel(c.key), a: value(c.from), b: value(c.to) })

  return (
    <aside className="card copilot" aria-label={t('title')}>
      <div className="copilot-head">
        <GlowIcon name="sparkle" tone="ai" size={34} breathe />
        {t('title')}
        {!isEmpty && (
          <button type="button" className="btn" onClick={copilot.reset}>
            <Icon name="plus" size={14} /> {t('new_chat')}
          </button>
        )}
      </div>
      <div className="copilot-body" aria-live="polite" ref={bodyRef}>
        {isEmpty && <p className="copilot-intro">{t('intro')}</p>}
        {copilot.messages.map((m, i) => (
          <div key={i} className={`msg ${m.role} ${m.isError ? 'error' : ''}`}>
            {!!m.steps?.some((s) => s.kind === 'tool' || s.kind === 'agent') && (
              <details className="trace-sum">
                <summary>{t('trace_summary', { n: m.steps.filter((s) => s.kind === 'tool' || s.kind === 'agent').length, s: m.seconds ?? 0 })}</summary>
                <AgentActivity steps={m.steps} />
              </details>
            )}
            {m.role === 'assistant' && !m.isError ? <Markdown text={m.text} /> : <p className="msg-text">{m.text}</p>}
            {!!m.changes?.length && (
              <div className="changes">
                <span className="lab ai">{t('changed')}</span>
                <ul>
                  {m.changes.map((c) => (
                    <li key={c.key}>{changeLabel(c)}</li>
                  ))}
                </ul>
                <button type="button" className="link small" onClick={undo} disabled={!canUndo}>
                  {t('undo')}
                </button>
              </div>
            )}
            {!!m.remembered?.length && (
              <div className="changes">
                <span className="lab ai">{t('remembered')}</span>
                <ul>{m.remembered.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            )}
            {m.guard && <p className={`xsmall ${m.guard === 'flagged' ? 'note bad' : 'muted'}`}>{t(m.guard === 'flagged' ? 'guard_flagged' : 'guard_ok')}</p>}
            {m.chart && <DynamicChart spec={m.chart} />}
            {m.calc && <CalcTrace calc={m.calc} label={tc('ai_calc')} />}
          </div>
        ))}
        {copilot.isBusy && (
          <div className="msg assistant">
            <AgentActivity steps={copilot.live} live />
          </div>
        )}
        <div className="suggestions">
          {(isEmpty ? EXAMPLES : EXAMPLES.slice(0, 3)).map((k) => (
            <button key={k} type="button" className="sugr" onClick={() => void copilot.ask(t(k))} disabled={copilot.isBusy}>
              <span>{t(k)}</span>
              <Icon name="arrow" size={16} />
            </button>
          ))}
        </div>
        {isEmpty && (
          <div className="copilot-empty">
            <CopilotIllustration />
            <span>{t('empty')}</span>
            <span className="xsmall">{t('note')}</span>
          </div>
        )}
      </div>
      <AskForm copilot={copilot} placeholder={t('input')} compact />
    </aside>
  )
}
