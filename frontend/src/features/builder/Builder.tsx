// AI Builder page: the prompt, the question to answer (pick an option or type), the live progress, and the draft to save.
// The flow itself (asking, building, saving) lives in useBuilderFlow.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { AgentActivity } from '../../components/AgentActivity'
import { Icon } from '../../components/Icon'
import { useMessages } from '../../i18n'
import { builder } from '../../i18n/builder'
import { common } from '../../i18n/common'
import { copilot as copilotMsg } from '../../i18n/copilot'
import { DraftPreview } from './DraftPreview'
import { useBuilderFlow } from './useBuilderFlow'

export function Builder({ onSaved }: { onSaved: (id: number) => void }) {
  const t = useMessages(builder)
  const tc = useMessages(common)
  const tp = useMessages(copilotMsg)
  const flow = useBuilderFlow()
  const { phase, ask, draft } = flow
  const [prompt, setPrompt] = useState('')
  const [own, setOwn] = useState('')
  const [change, setChange] = useState('')

  const handleGenerate = (e: FormEvent) => {
    e.preventDefault()
    if (prompt.trim().length >= 3) flow.start(prompt.trim())
  }
  const answer = (text: string) => {
    if (flow.answer(text)) setOwn('')
  }
  const reset = () => {
    flow.reset()
    setOwn('')
  }

  const isLocked = phase === 'checking' || phase === 'asking' || phase === 'building'
  const worked = flow.steps.filter((s) => s.kind === 'tool' || s.kind === 'agent').length
  return (
    <>
      <div className="breadcrumb">
        <span>{t('crumb')}</span>
        <span aria-hidden="true">/</span>
        <strong>{tc('nav_build')}</strong>
      </div>
      <form className="card prompt-card" onSubmit={handleGenerate} data-tour="build-prompt">
        <label>
          <span className="lab ai">{t('prompt_label')}</span>
          <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('example')} maxLength={1000} disabled={isLocked} />
        </label>
        <button type="submit" className="btn primary lg" disabled={isLocked || prompt.trim().length < 3}>
          <Icon name="sparkle" size={16} /> {isLocked ? tc('ai_thinking') : t('generate')}
        </button>
      </form>
      <div className="row" data-tour="build-example">
        <button type="button" className="chip" onClick={() => setPrompt(t('example'))} disabled={isLocked}>
          {t('example')}
        </button>
        <span className="muted xsmall">{t('note')}</span>
        {isLocked && <button type="button" className="link small" onClick={reset}>{t('cancel')}</button>}
      </div>
      {flow.error && <p className="note bad">{tc('ai_error')} {flow.error}</p>}
      {flow.refused && <p className="note bad">{flow.refused}</p>}
      {flow.reply && <p className="note">{flow.reply}</p>}

      {flow.answers.length > 0 && isLocked && (
        <section className="card thread" aria-label={t('thread')}>
          {flow.answers.map((a, i) => (
            <div key={`${i}-${a.question}`}>
              <p className="thread-q">{a.question}</p>
              <p className="thread-a">{a.answer}</p>
            </div>
          ))}
        </section>
      )}

      {phase === 'checking' && (
        <section className="card" aria-live="polite">
          <AgentActivity steps={[]} live />
        </section>
      )}

      {phase === 'asking' && ask && (
        <section className="card ask-card" aria-live="polite">
          <span className="lab ai">{t('ask_round', { n: ask.round, max: ask.max })}</span>
          <h3>{ask.question}</h3>
          <div className="chips" role="group" aria-label={ask.question}>
            {ask.options.map((o) => (
              <button key={o} type="button" className="chip" onClick={() => answer(o)}>{o}</button>
            ))}
          </div>
          <form className="ask-own" onSubmit={(e) => { e.preventDefault(); answer(own) }}>
            <input type="text" value={own} onChange={(e) => setOwn(e.target.value)} placeholder={t('own_ph')} maxLength={300} aria-label={t('own_ph')} />
            <button type="submit" className="btn primary" disabled={!own.trim()}>{t('send')}</button>
          </form>
          <button type="button" className="link small" onClick={flow.skip}>{t('skip')}</button>
        </section>
      )}

      {phase === 'building' && (
        <section className="card" aria-live="polite">
          <AgentActivity steps={flow.steps} live />
        </section>
      )}

      {phase === 'draft' && draft && (
        <>
          {worked > 0 && (
            <details className="trace-sum">
              <summary>{tp('trace_summary', { n: worked, s: flow.seconds })}</summary>
              <AgentActivity steps={flow.steps} />
            </details>
          )}
          <section className="card ai">
            <div className="card-head">
              <div className="card-title">
                <span className="ai-pill">{t('draft_tag')}</span>
                <h3 style={{ fontSize: 22, fontWeight: 800 }}>{draft.title}</h3>
              </div>
              <div className="card-actions">
                <button type="button" className="btn" onClick={reset}>{t('new')}</button>
                <button type="button" className="btn primary" onClick={() => void flow.save(onSaved)} disabled={flow.isSaving}>{t('save')}</button>
              </div>
            </div>
            <p className="muted small">{t('draft')}</p>
          </section>
          <form className="card prompt-card" onSubmit={(e) => { e.preventDefault(); flow.refine(change); setChange('') }}>
            <label>
              <span className="lab ai">{t('refine_label')}</span>
              <input type="text" value={change} onChange={(e) => setChange(e.target.value)} placeholder={t('refine_ph')} maxLength={1000} />
            </label>
            <button type="submit" className="btn primary" disabled={change.trim().length < 3}>
              <Icon name="sparkle" size={16} /> {t('refine_send')}
            </button>
            {flow.canUndo && <button type="button" className="btn" onClick={flow.undo}>{t('undo')}</button>}
          </form>
          <DraftPreview key={flow.draftKey} draft={draft} />
        </>
      )}
    </>
  )
}
