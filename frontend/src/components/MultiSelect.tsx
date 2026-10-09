// Multi-value filter: a button summarising the choice, opening a panel with search, include/exclude and a checkbox per value
// with its order count (values with no orders under the other filters are greyed but still selectable).
import { useId, useRef, useState } from 'react'
import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { filters as filtersMsg } from '../i18n/filters'
import type { FacetValue } from '../lib/types'
import { Hint } from './Hint'
import { Icon } from './Icon'
import { useDismiss } from './useDismiss'
import type { IconName } from './Icon'
import { Seg } from './Seg'

type Props = {
  label: string
  icon: IconName
  allLabel: string
  options: FacetValue[]
  selected: string[]
  exclude: boolean
  isAI?: boolean
  /** How a value reads on screen when it is a code in the data (an order status). */
  format?: (value: string) => string
  /** A caveat that goes with the filter, shown when the label is hovered. */
  note?: string
  /** Extra text shown after a value, e.g. the region of a warehouse. */
  hint?: (o: FacetValue) => string | undefined
  onChange: (values: string[], exclude: boolean) => void
}

export function MultiSelect({ label, icon, allLabel, options, selected, exclude, isAI, format = (v) => v, note, hint, onChange }: Props) {
  const t = useMessages(filtersMsg)
  const tc = useMessages(common)
  const [isOpen, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useDismiss(root, isOpen, () => setOpen(false))

  const shown = options.filter((o) => `${format(o.value)} ${o.value} ${hint?.(o) ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v], exclude)
  const names = selected.map(format)
  const list = names.length > 2 ? t('more', { a: names.slice(0, 2).join(', '), n: names.length - 2 }) : names.join(', ')
  const summary = selected.length === 0 ? allLabel : exclude ? t('except_prefix', { v: list }) : list

  return (
    <div className="filter multi" ref={root}>
      <span className="filter-label">
        <Icon name={icon} size={14} />
        {note ? <Hint text={note}>{label}</Hint> : label}
        {isAI && <span className="ai-pill">{tc('ai_tag')}</span>}
      </span>
      <button
        type="button"
        className={`sel multi-btn${isAI ? ' is-ai' : ''}${selected.length ? ' has-value' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => setOpen(!isOpen)}
      >
        <span className="ellipsis">{summary}</span>
        <Icon name="chevron" size={14} />
      </button>
      {isOpen && (
        <div className="popover card multi-panel" id={panelId} role="dialog" aria-label={label}>
          {options.length > 8 && <input className="sel" type="search" autoFocus placeholder={t('search')} aria-label={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} />}
          <div className="multi-tools">
            <Seg label={t('mode')} value={exclude ? 'out' : 'in'} onChange={(m) => onChange(selected, m === 'out')} options={[['in', t('include')], ['out', t('exclude')]]} />
            <button type="button" className="link small" onClick={() => onChange(options.map((o) => o.value), exclude)}>{t('select_all')}</button>
            <button type="button" className="link small" onClick={() => onChange([], false)} disabled={selected.length === 0}>{t('clear')}</button>
          </div>
          <ul className="multi-list">
            {shown.map((o) => (
              <li key={o.value}>
                <label className={`multi-opt${o.n === 0 ? ' empty' : ''}`} title={o.n === 0 ? t('empty_hint') : undefined}>
                  <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                  <span className="ellipsis">{format(o.value)}{hint?.(o) ? <span className="muted"> · {hint(o)}</span> : null}</span>
                  <span className="num muted xsmall">{o.n}</span>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="muted small">{t('no_match')}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
