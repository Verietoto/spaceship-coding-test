// Backoffice > Documents: the team's documents the copilot answers from (admin only): list and search, read, add, edit, delete.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '../../app/useApi'
import { useCall } from '../../app/useCall'
import { useDebounced } from '../../app/useDebounced'
import { GlowIcon } from '../../components/GlowIcon'
import { Markdown } from '../../components/Markdown'
import { useMessages } from '../../i18n'
import { useFormat } from '../../i18n/format'
import { backoffice } from '../../i18n/backoffice'
import { common } from '../../i18n/common'
import { api } from '../../lib/api'

type DocItem = { id: number; slug: string | null; title: string; updated_at: string }
type Doc = DocItem & { body: string }
type Draft = { id: number | null; title: string; body: string; slug: string }

export function Documents() {
  const t = useMessages(backoffice)
  const tc = useMessages(common)
  const fmt = useFormat()
  const { version, error, call } = useCall()
  const [q, setQ] = useState('')
  const query = useDebounced(q.trim(), 250) // one request when typing pauses, not one per key
  const { data: docs } = useApi<DocItem[]>('knowledge/docs', query ? { q: query, v: version } : { v: version })
  const [openId, setOpenId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const body = { title: draft.title, body: draft.body, slug: draft.slug.trim() || null }
    const ok = await call(() => (draft.id == null ? api('knowledge/docs', {}, body) : api(`knowledge/docs/${draft.id}`, {}, body, 'PUT')))
    if (ok) setDraft(null)
  }

  if (draft) {
    return (
      <section className="card glow-host">
        <form className="form-stack" onSubmit={(e) => void handleSubmit(e)}>
          <h3>{draft.id == null ? t('new_doc') : t('edit_doc')}</h3>
          <label className="field">
            {t('f_title')}
            <input type="text" maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
          </label>
          <label className="field">
            {t('f_slug')}
            <input type="text" pattern="[a-z0-9\-]{1,40}" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
          </label>
          <label className="field">
            {t('f_body')}
            <textarea rows={12} maxLength={50000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} required />
          </label>
          {error && <p className="note bad">{error}</p>}
          <div className="row">
            <button type="submit" className="btn primary">{tc('save')}</button>
            <button type="button" className="btn" onClick={() => setDraft(null)}>{tc('cancel')}</button>
          </div>
        </form>
      </section>
    )
  }

  if (openId != null) {
    return (
      <DocView
        id={openId}
        version={version}
        error={error}
        onBack={() => setOpenId(null)}
        onEdit={(d) => setDraft({ id: d.id, title: d.title, body: d.body, slug: d.slug ?? '' })}
        onDelete={() => void call(() => api(`knowledge/docs/${openId}`, {}, undefined, 'DELETE')).then((ok) => ok && setOpenId(null))}
      />
    )
  }

  return (
    <section className="card glow-host">
      <div className="card-head">
        <div className="card-title">
          <GlowIcon name="reports" tone="t5" />
          <div>
            <h3>{t('docs_title')}</h3>
            <p>{t('docs_sub')}</p>
          </div>
        </div>
        <button type="button" className="btn primary" onClick={() => setDraft({ id: null, title: '', body: '', slug: '' })}>{t('new_doc')}</button>
      </div>
      <div className="form-stack">
        <input type="search" aria-label={t('search')} placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        {!docs?.length ? (
          <p className="muted small">{t('docs_none')}</p>
        ) : (
          <ul className="schedule-list">
            {docs.map((d) => (
              <li key={d.id}>
                <div>
                  <strong>{d.title}</strong>
                  <div className="muted">{t('updated', { d: fmt.date(d.updated_at.slice(0, 10)) })}</div>
                </div>
                <button type="button" className="btn" onClick={() => setOpenId(d.id)}>{t('open')}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

type DocViewProps = {
  id: number
  version: number
  error: string | null
  onBack: () => void
  onEdit: (d: Doc) => void
  onDelete: () => void
}

function DocView({ id, version, error, onBack, onEdit, onDelete }: DocViewProps) {
  const t = useMessages(backoffice)
  const tc = useMessages(common)
  const fmt = useFormat()
  const { data } = useApi<Doc>(`knowledge/docs/${id}`, { v: version })
  return (
    <section className="card glow-host">
      <div className="row">
        <button type="button" className="btn" onClick={onBack}>{t('back')}</button>
        {data && <button type="button" className="btn" onClick={() => onEdit(data)}>{t('edit')}</button>}
        <button type="button" className="btn danger" onClick={onDelete}>{tc('remove')}</button>
      </div>
      {data && (
        <div className="form-stack" style={{ marginTop: 12 }}>
          <h3>{data.title}</h3>
          <p className="muted xsmall">{t('updated', { d: fmt.date(data.updated_at.slice(0, 10)) })}</p>
          <Markdown text={data.body} />
        </div>
      )}
      {error && <p className="note bad">{error}</p>}
    </section>
  )
}
