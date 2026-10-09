// A saved dashboard: its SQL re-runs on open, so data is always current. The AI can still change it: a prompt makes a proposal
// (shown with its own working filters), and only "Save changes" replaces the saved version.
import { useState } from 'react'
import { useApp } from '../../app/useApp'
import { useApi } from '../../app/useApi'
import { AgentActivity } from '../../components/AgentActivity'
import { DashboardFilters } from '../../components/DashboardFilters'
import { Icon } from '../../components/Icon'
import { Status } from '../../components/Status'
import { useMessages } from '../../i18n'
import { builder } from '../../i18n/builder'
import { common } from '../../i18n/common'
import { Unauthorized, api, fq } from '../../lib/api'
import { DEFAULT_FILTERS } from '../../lib/types'
import type { Filters } from '../../lib/types'
import { DraftPreview } from './DraftPreview'
import type { Draft } from './types'
import { useBuilderFlow } from './useBuilderFlow'
import { Widgets } from './Widgets'

type Saved = Draft & { id: number; created_at: string; can_edit: boolean }
export type DashboardItem = { id: number; title: string; created_at: string }

type Props = { id: number; onDeleted: () => void; onChanged: () => void }

export function SavedDashboard({ id, onDeleted, onChanged }: Props) {
  const { onUnauthorized } = useApp()
  const t = useMessages(builder)
  const tc = useMessages(common)
  const flow = useBuilderFlow()
  const [version, setVersion] = useState(0) // bumped when a change is saved, so the dashboard is read again
  const [values, setValues] = useState<Filters | null>(null) // null: the dashboard's own defaults, until the viewer changes a filter
  const [change, setChange] = useState('')
  const { data, error, isLoading } = useApi<Saved>(`dashboards/${id}`, { v: version, ...(values && { custom: true, ...fq(values) }) })
  const [isDeleting, setDeleting] = useState(false)
  if (!data) return <Status isLoading={isLoading} error={error} />

  const isProposing = flow.phase === 'draft' && flow.draft != null
  const isWorking = flow.phase === 'building'
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api(`dashboards/${id}`, {}, undefined, 'DELETE')
      onDeleted()
    } catch (e: unknown) {
      if (e instanceof Unauthorized) onUnauthorized()
      setDeleting(false)
    }
  }
  const handleSave = () =>
    void flow.save(() => {
      flow.reset()
      setValues(null)
      setVersion((v) => v + 1)
      onChanged() // the sidebar list shows the new title
    }, id)

  return (
    <>
      <div className="section-head">
        <div>
          <h1>{isProposing ? flow.draft?.title : data.title}</h1>
          <p className="muted small">{t(data.filters?.length ? 'data_note_filters' : 'data_note')}</p>
        </div>
        <button type="button" className="btn ghost" onClick={() => void handleDelete()} disabled={isDeleting || isWorking}>
          <Icon name="trash" size={16} /> {t('delete')}
        </button>
      </div>

      {data.can_edit && !isProposing && (
        <form className="card prompt-card" onSubmit={(e) => { e.preventDefault(); flow.refine(change, data); setChange('') }}>
          <label>
            <span className="lab ai">{t('refine_label')}</span>
            <input type="text" value={change} onChange={(e) => setChange(e.target.value)} placeholder={t('refine_ph')} maxLength={1000} disabled={isWorking} />
          </label>
          <button type="submit" className="btn primary" disabled={isWorking || change.trim().length < 3}>
            <Icon name="sparkle" size={16} /> {isWorking ? tc('ai_thinking') : t('refine_send')}
          </button>
        </form>
      )}
      {flow.error && <p className="note bad">{tc('ai_error')} {flow.error}</p>}
      {flow.refused && <p className="note bad">{flow.refused}</p>}
      {flow.reply && <p className="note">{flow.reply}</p>}
      {isWorking && (
        <section className="card" aria-live="polite">
          <AgentActivity steps={flow.steps} live />
        </section>
      )}

      {isProposing && flow.draft ? (
        <>
          <section className="card ai">
            <div className="card-head">
              <div className="card-title">
                <span className="ai-pill">{t('draft_tag')}</span>
                <p className="muted small">{t('proposed')}</p>
              </div>
              <div className="card-actions">
                <button type="button" className="btn" onClick={flow.reset} disabled={flow.isSaving}>{t('discard')}</button>
                <button type="button" className="btn primary" onClick={handleSave} disabled={flow.isSaving}>{t('save_changes')}</button>
              </div>
            </div>
          </section>
          <DraftPreview key={flow.draftKey} draft={flow.draft} />
        </>
      ) : (
        <>
            {!!data.filters?.length && (
              <DashboardFilters
                specs={data.filters}
                value={values ?? data.applied ?? DEFAULT_FILTERS}
                onChange={setValues}
                onReset={() => setValues(null)}
                isDefault={values === null}
              />
            )}
            <Widgets widgets={data.widgets} />
          </>
      )}
    </>
  )
}
