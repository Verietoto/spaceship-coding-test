// The global filter bar (a card): period, region, warehouse, carrier, client, then
// reset / presets / copy link / export PDF, the active filters as removable chips, and the order count.
import { useState } from 'react'
import { useApi } from '../app/useApi'
import { useApp } from '../app/useApp'
import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { filters as filtersMsg } from '../i18n/filters'
import { useFormat } from '../i18n/format'
import { fq } from '../lib/api'
import { extraCount, isDefault } from '../lib/filterQuery'
import { DIMENSIONS, RANGE_KEYS } from '../lib/types'
import type { Facets } from '../lib/types'
import { CORE, FilterField, MORE } from './FilterField'
import { Icon } from './Icon'
import { PeriodPicker } from './PeriodPicker'
import { PresetsMenu } from './PresetsMenu'
import { useRangeText, useValueLabel } from './useValueLabel'

export function FilterBar() {
  const { view, meta, setDim, setRange, setBounds, setArrived, reset } = useApp()
  const t = useMessages(filtersMsg)
  const tc = useMessages(common)
  const fmt = useFormat()
  const { f, ai } = view
  const { data } = useApi<Facets>('facets', fq(f))
  const [copied, setCopied] = useState(false)
  const [isMoreOpen, setMoreOpen] = useState(() => extraCount(view.f) > 0) // a shared link that sets them shows them
  const valueLabel = useValueLabel()
  const rangeText = useRangeText()
  const on = { setDim, setBounds, setArrived }
  const extra = extraCount(f)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the address bar already holds the link */
    }
  }

  const bounds = data?.bounds ?? meta?.bounds
  const years = data?.years ?? meta?.years ?? []
  const chips: { key: string; text: string; remove: () => void }[] = []
  if (f.start || f.end) chips.push({ key: 'period', text: t('eq', { k: tc('f_period'), v: fmt.range(f.start, f.end) }), remove: () => setRange(null, null) })
  for (const d of DIMENSIONS)
    for (const v of f[d])
      chips.push({
        key: `${d}:${v}`,
        text: t(f.exclude.includes(d) ? 'not_eq' : 'eq', { k: tc(`f_${d}`), v: valueLabel(d, v) }),
        remove: () => setDim(d, f[d].filter((x) => x !== v), f.exclude.includes(d)),
      })
  for (const k of RANGE_KEYS) {
    const b = f.ranges[k]
    if (b) chips.push({ key: `range:${k}`, text: t('eq', { k: tc(`f_${k}`), v: rangeText(b) }), remove: () => setBounds(k, null, null) })
  }
  if (f.arrived_start || f.arrived_end) chips.push({ key: 'arrived', text: t('eq', { k: tc('f_arrived'), v: fmt.range(f.arrived_start, f.arrived_end) }), remove: () => setArrived(null, null) })

  return (
    <div className="filterbar" data-tour="filters">
      <div className="card filter-card">
        {bounds && <PeriodPicker years={years} bounds={bounds} />}
        {CORE.map((d) => (
          <FilterField key={d} field={d} f={f} facets={data} ai={ai} on={on} />
        ))}
        <div className="filter-buttons">
          <button type="button" className="btn ghost" aria-expanded={isMoreOpen} onClick={() => setMoreOpen(!isMoreOpen)}>
            <Icon name="plus" size={16} /> {extra ? t('more_filters_n', { n: extra }) : t('more_filters')}
          </button>
          <button type="button" className="btn ghost" onClick={reset} disabled={isDefault(f)}>
            {t('reset')}
          </button>
          <PresetsMenu />
          <button type="button" className="btn ghost" onClick={() => void copyLink()}>
            <Icon name={copied ? 'check' : 'link'} size={16} /> {copied ? t('copied') : t('copy_link')}
          </button>
          <button type="button" className="btn ghost" onClick={() => window.print()}>
            <Icon name="download" size={16} /> {t('export_pdf')}
          </button>
        </div>
      </div>
      {isMoreOpen && (
        <div className="card filter-card more-filters" role="group" aria-label={t('more_filters')}>
          {MORE.map((field) => (
            <FilterField key={field} field={field} f={f} facets={data} ai={ai} on={on} />
          ))}
        </div>
      )}
      {chips.length > 0 && (
        <ul className="chips-active" aria-label={t('active')}>
          {chips.map((c) => (
            <li key={c.key} className="chip-active">
              <span>{c.text}</span>
              <button type="button" aria-label={t('remove', { v: c.text })} onClick={c.remove}>
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="filter-summary">{data ? tc('of_orders', { a: fmt.int(data.total), b: fmt.int(meta?.total ?? data.total) }) : '…'}</p>
    </div>
  )
}
