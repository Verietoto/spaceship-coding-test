// Backoffice > AI: which provider, key and model the AI runs on. The key is write-only: the server never sends it back.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '../../app/useApi'
import { useCall } from '../../app/useCall'
import { GlowIcon } from '../../components/GlowIcon'
import { useMessages } from '../../i18n'
import { backoffice } from '../../i18n/backoffice'
import { common } from '../../i18n/common'
import { useFormat } from '../../i18n/format'
import { api, errorText } from '../../lib/api'

type Provider = 'openai' | 'openrouter'
type AiView = {
  providers: Provider[]
  secrets_available: boolean
  provider: Provider
  model: string
  subagent_model: string
  key: { source: 'db' | 'env' | 'none'; last4: string | null }
  updated_by: string | null
  updated_at: string | null
}
type Edit = { provider?: Provider; model?: string; subagent_model?: string; api_key?: string }
type Test = { state: 'idle' | 'running' } | { state: 'done'; ok: boolean; error?: string }

export function AiSettings() {
  const t = useMessages(backoffice)
  const tc = useMessages(common)
  const fmt = useFormat()
  const { version, error, call } = useCall()
  const { data } = useApi<AiView>('admin/ai', { v: version })
  const [edit, setEdit] = useState<Edit>({})
  const [test, setTest] = useState<Test>({ state: 'idle' })
  const [isSaved, setSaved] = useState(false)
  if (!data) return null

  const form = { provider: edit.provider ?? data.provider, model: edit.model ?? data.model, subagent_model: edit.subagent_model ?? data.subagent_model, api_key: edit.api_key ?? '' }
  const set = (patch: Edit) => {
    setEdit({ ...edit, ...patch })
    setTest({ state: 'idle' })
    setSaved(false)
  }
  const keyNote =
    data.key.source === 'db' ? t('key_db', { l4: data.key.last4 ?? '' }) : data.key.source === 'env' ? t('key_env', { l4: data.key.last4 ?? '' }) : t('key_missing')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await call(() => api('admin/ai', {}, form, 'PUT'))
    if (ok) {
      setEdit({})
      setSaved(true)
    }
  }
  const handleTest = async () => {
    setTest({ state: 'running' })
    try {
      const r = await api<{ ok: boolean; error?: string }>('admin/ai/test', {}, form)
      setTest({ state: 'done', ...r })
    } catch (e: unknown) {
      setTest({ state: 'done', ok: false, error: errorText(e) })
    }
  }

  return (
    <section className="card glow-host">
      <div className="card-head">
        <div className="card-title">
          <GlowIcon name="sparkle" tone="ai" />
          <div>
            <h3>{t('ai_title')}</h3>
            <p>{t('ai_sub')}</p>
          </div>
        </div>
      </div>
      <form className="form-stack" onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          {t('provider')}
          <select value={form.provider} onChange={(e) => set({ provider: e.target.value as Provider })}>
            {data.providers.map((p) => (
              <option key={p} value={p}>{t(`p_${p}`)}</option>
            ))}
          </select>
        </label>
        <label className="field">
          {t('model')}
          <input type="text" required maxLength={80} pattern="[\w.:/\-]{1,80}" value={form.model} onChange={(e) => set({ model: e.target.value })} />
          <span className="muted xsmall">{t('model_hint')}</span>
        </label>
        <label className="field">
          {t('subagent')}
          <input type="text" maxLength={80} pattern="[\w.:/\-]{0,80}" value={form.subagent_model} onChange={(e) => set({ subagent_model: e.target.value })} />
          <span className="muted xsmall">{t('subagent_hint')}</span>
        </label>
        <label className="field">
          {t('key')}
          <input type="password" autoComplete="off" maxLength={300} disabled={!data.secrets_available} placeholder={data.key.source === 'none' ? t('key_none') : t('key_new')} value={form.api_key} onChange={(e) => set({ api_key: e.target.value })} />
          <span className="muted xsmall">{data.secrets_available ? keyNote : t('key_locked')}</span>
        </label>
        {data.key.source === 'db' && (
          <button type="button" className="link small" onClick={() => void call(() => api('admin/ai/key', {}, undefined, 'DELETE'))}>{t('key_remove')}</button>
        )}
        {error && <p className="note bad">{error}</p>}
        {test.state === 'done' && <p className={`note ${test.ok ? 'good' : 'bad'}`} role="status">{test.ok ? t('test_ok') : t('test_fail', { e: test.error ?? '' })}</p>}
        {isSaved && <p className="note good" role="status">{t('saved')}</p>}
        <div className="row">
          <button type="submit" className="btn primary">{tc('save')}</button>
          <button type="button" className="btn" disabled={test.state === 'running'} onClick={() => void handleTest()}>{test.state === 'running' ? t('testing') : t('test')}</button>
        </div>
        {data.updated_by && data.updated_at && <p className="muted xsmall">{t('last', { u: data.updated_by, d: fmt.date(data.updated_at.slice(0, 10)) })}</p>}
      </form>
    </section>
  )
}
