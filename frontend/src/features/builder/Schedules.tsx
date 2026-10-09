// Report schedules: stored with the active filters; email delivery is simulated.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '../../app/useApi'
import { useApp } from '../../app/useApp'
import { useMe } from '../../app/useMe'
import { GlowIcon } from '../../components/GlowIcon'
import { useFilterLines } from '../../components/useFilterLines'
import { useMessages } from '../../i18n'
import { schedules as schedulesMsg } from '../../i18n/schedules'
import { Unauthorized, api, errorText } from '../../lib/api'
import type { Filters } from '../../lib/types'

const FREQUENCIES = ['weekly', 'monthly'] as const
const CONTENTS = ['summary', 'kpis', 'risk', 'csv'] as const
type Content = (typeof CONTENTS)[number]
type Schedule = { id: number; frequency: (typeof FREQUENCIES)[number]; recipients: string[]; contents: Content[]; filters: Filters; created_at: string }

/** Schedules are admin-only on the server; a visitor never sees the section. */
export function Schedules() {
  const { isAdmin } = useMe()
  return isAdmin ? <ScheduleSection /> : null
}

function ScheduleSection() {
  const { view, onUnauthorized } = useApp()
  const t = useMessages(schedulesMsg)
  const filterLines = useFilterLines()
  const [version, setVersion] = useState(0)
  const { data } = useApi<Schedule[]>('schedules', { v: version })
  const [frequency, setFrequency] = useState<Schedule['frequency']>('weekly')
  const [recipients, setRecipients] = useState('')
  const [contents, setContents] = useState<Content[]>(['summary', 'kpis'])
  const [error, setError] = useState<string | null>(null)

  const call = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      setVersion((v) => v + 1)
      return true
    } catch (e: unknown) {
      if (e instanceof Unauthorized) onUnauthorized()
      setError(errorText(e))
      return false
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const list = recipients.split(',').map((x) => x.trim()).filter(Boolean)
    const ok = await call(() => api('schedules', {}, { frequency, recipients: list, contents, filters: view.f }))
    if (ok) setRecipients('')
  }

  const toggle = (c: Content) => setContents((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))

  return (
    <section className="card glow-host">
      <div className="card-head">
        <div className="card-title">
          <GlowIcon name="calendar" tone="t5" />
          <div>
            <h3>{t('title')}</h3>
            <p>{t('sub')}</p>
          </div>
        </div>
      </div>
      <form className="form-stack" onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          {t('frequency')}
          <select className="sel" value={frequency} onChange={(e) => setFrequency(e.target.value as Schedule['frequency'])}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{t(f)}</option>)}
          </select>
        </label>
        <label className="field">
          {t('recipients')}
          <input type="text" inputMode="email" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder={t('recipients_example')} required />
        </label>
        <div className="field">
          {t('contents')}
          <div className="chips" role="group" aria-label={t('contents')}>
            {CONTENTS.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={contents.includes(c)} onClick={() => toggle(c)}>
                {t(`c_${c}`)}
              </button>
            ))}
          </div>
        </div>
        <p className="muted xsmall">{t('uses_filters', { v: filterLines(view.f).join(' · ') })}</p>
        {error && <p className="note bad">{error}</p>}
        <button type="submit" className="btn primary" style={{ justifySelf: 'start' }} disabled={contents.length === 0}>
          {t('save')}
        </button>
      </form>

      <div className="form-stack" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line2)' }}>
        <span className="lab">{t('list')}</span>
        {!data?.length ? (
          <p className="muted small">{t('none')}</p>
        ) : (
          <ul className="schedule-list">
            {data.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>{t(s.frequency)}</strong>
                  <div className="muted">
                    {s.recipients.join(', ')} · {s.contents.map((c) => t(`c_${c}`)).join(', ')} · {filterLines(s.filters).join(' · ')}
                  </div>
                </div>
                <button type="button" className="btn danger" onClick={() => void call(() => api(`schedules/${s.id}`, {}, undefined, 'DELETE'))}>
                  {t('delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
