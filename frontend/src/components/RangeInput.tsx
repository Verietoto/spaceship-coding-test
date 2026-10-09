// A number range: a lowest and a highest value (either may stay empty), applied when a box loses focus or Enter is pressed.
// Placeholders show what the data holds. Mount it again (a new `key`) when the value changes from outside.
import { useState } from 'react'
import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { filters as filtersMsg } from '../i18n/filters'
import type { Bounds } from '../lib/types'
import { Hint } from './Hint'
import { Icon } from './Icon'
import type { IconName } from './Icon'

type Props = {
  label: string
  icon: IconName
  bounds?: { min: number | null; max: number | null }
  value?: Bounds
  isAI?: boolean
  note?: string
  onChange: (lo: number | null, hi: number | null) => void
}

const parse = (text: string): number | null | undefined => {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : undefined // undefined: not a number
}

export function RangeInput({ label, icon, bounds, value, isAI, note, onChange }: Props) {
  const t = useMessages(filtersMsg)
  const tc = useMessages(common)
  const [lo, setLo] = useState(value?.[0] == null ? '' : String(value[0]))
  const [hi, setHi] = useState(value?.[1] == null ? '' : String(value[1]))
  const a = parse(lo)
  const b = parse(hi)
  const isInvalid = a === undefined || b === undefined || (a !== null && b !== null && a > b)
  const commit = () => {
    if (isInvalid || a === undefined || b === undefined) return
    if (a !== (value?.[0] ?? null) || b !== (value?.[1] ?? null)) onChange(a, b)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit()
  }
  const isSet = value != null
  return (
    <div className="filter range">
      <span className="filter-label">
        <Icon name={icon} size={14} />
        {note ? <Hint text={note}>{label}</Hint> : label}
        {isAI && <span className="ai-pill">{tc('ai_tag')}</span>}
      </span>
      <div className="range-inputs">
        <input type="number" step="any" inputMode="decimal" className={`sel${isInvalid ? ' invalid' : ''}`} aria-label={`${label}: ${t('from')}`} aria-invalid={isInvalid} placeholder={bounds?.min == null ? t('from') : String(bounds.min)} value={lo} onChange={(e) => setLo(e.target.value)} onBlur={commit} onKeyDown={onKey} />
        <span aria-hidden="true">–</span>
        <input type="number" step="any" inputMode="decimal" className={`sel${isInvalid ? ' invalid' : ''}`} aria-label={`${label}: ${t('to')}`} aria-invalid={isInvalid} placeholder={bounds?.max == null ? t('to') : String(bounds.max)} value={hi} onChange={(e) => setHi(e.target.value)} onBlur={commit} onKeyDown={onKey} />
        {isSet && (
          <button type="button" className="icon-btn" aria-label={t('range_clear', { k: label })} title={t('range_clear', { k: label })} onClick={() => onChange(null, null)}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {isInvalid && a !== undefined && b !== undefined && <span className="note bad xsmall">{t('range_invalid')}</span>}
    </div>
  )
}
