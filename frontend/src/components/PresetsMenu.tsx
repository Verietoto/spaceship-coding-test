// Saved filter views: apply one, delete one, or save the current view under a name (shared by everyone for now).
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '../app/useApi'
import { useApp } from '../app/useApp'
import { useMessages } from '../i18n'
import { filters as filtersMsg } from '../i18n/filters'
import { Unauthorized, api, errorText } from '../lib/api'
import { DEFAULT_FILTERS, savedCompare } from '../lib/types'
import type { Compare, Filters } from '../lib/types'
import { Icon } from './Icon'
import { useDismiss } from './useDismiss'

type Preset = { id: number; name: string; filters: Filters & { compare: Compare } }

export function PresetsMenu() {
  const { view, applyView, onUnauthorized } = useApp()
  const t = useMessages(filtersMsg)
  const [isOpen, setOpen] = useState(false)
  const [version, setVersion] = useState(0)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data } = useApi<Preset[]>('presets', { v: version })
  const root = useRef<HTMLDivElement>(null)

  useDismiss(root, isOpen, () => setOpen(false))

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

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (await call(() => api('presets', {}, { name: name.trim(), filters: view.f, compare: savedCompare(view.compare) }))) setName('')
  }

  return (
    <div className="popover-wrap" ref={root}>
      <button type="button" className="btn ghost" aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}>
        <Icon name="bookmark" size={16} /> {t('presets')}
      </button>
      {isOpen && (
        <div className="popover card" role="dialog" aria-label={t('presets')}>
          <ul className="schedule-list">
            {data?.length ? (
              data.map((p) => (
                <li key={p.id}>
                  <button type="button" className="link" onClick={() => { applyView({ ...DEFAULT_FILTERS, ...p.filters }, p.filters.compare); setOpen(false) }}>
                    {p.name}
                  </button>
                  <button type="button" className="icon-btn" aria-label={t('preset_delete', { v: p.name })} onClick={() => void call(() => api(`presets/${p.id}`, {}, undefined, 'DELETE'))}>
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              ))
            ) : (
              <li className="muted small">{t('presets_none')}</li>
            )}
          </ul>
          <form className="row" onSubmit={(e) => void save(e)}>
            <input className="sel" style={{ flex: 1, minWidth: 0 }} maxLength={60} placeholder={t('preset_name')} aria-label={t('preset_name')} value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="btn primary" disabled={!name.trim()}>{t('preset_save')}</button>
          </form>
          {error && <p className="note bad small">{error}</p>}
        </div>
      )}
    </div>
  )
}
