// Knowledge > About me: the notes the copilot keeps about you (only you see them).
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '../../app/useApi'
import { GlowIcon } from '../../components/GlowIcon'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { knowledge } from '../../i18n/knowledge'
import { api } from '../../lib/api'
import { useCall } from '../../app/useCall'

type Fact = { id: number; text: string; source: 'manual' | 'chat' }

export function AboutMe() {
  const t = useMessages(knowledge)
  const tc = useMessages(common)
  const { version, error, call } = useCall()
  const { data } = useApi<Fact[]>('knowledge/facts', { v: version })
  const [text, setText] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (await call(() => api('knowledge/facts', {}, { text }))) setText('')
  }

  return (
    <section className="card glow-host">
      <div className="card-head">
        <div className="card-title">
          <GlowIcon name="clients" tone="t3" />
          <div>
            <h3>{t('me_title')}</h3>
            <p>{t('me_sub')}</p>
          </div>
        </div>
      </div>
      <form className="form-stack" onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          {t('me_title')}
          <input type="text" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('me_placeholder')} required />
        </label>
        {error && <p className="note bad">{error}</p>}
        <button type="submit" className="btn primary" style={{ justifySelf: 'start' }}>{t('me_add')}</button>
      </form>
      <div className="form-stack" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line2)' }}>
        {!data?.length ? (
          <p className="muted small">{t('me_none')}</p>
        ) : (
          <ul className="schedule-list">
            {data.map((f) => (
              <li key={f.id}>
                <div>
                  <strong>{f.text}</strong>
                  {f.source === 'chat' && <div className="muted">{t('from_chat')}</div>}
                </div>
                <button type="button" className="btn danger" onClick={() => void call(() => api(`knowledge/facts/${f.id}`, {}, undefined, 'DELETE'))}>
                  {tc('remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
