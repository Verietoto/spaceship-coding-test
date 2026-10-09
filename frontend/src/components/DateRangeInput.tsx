// Two dates, from and until (either may stay empty): the arrival date range. Dates are applied as soon as they are picked.
import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { filters as filtersMsg } from '../i18n/filters'
import { Hint } from './Hint'
import { Icon } from './Icon'

type Props = {
  label: string
  bounds?: { min: string | null; max: string | null }
  start: string | null
  end: string | null
  isAI?: boolean
  note?: string
  onChange: (start: string | null, end: string | null) => void
}

export function DateRangeInput({ label, bounds, start, end, isAI, note, onChange }: Props) {
  const t = useMessages(filtersMsg)
  const tc = useMessages(common)
  const min = bounds?.min ?? undefined
  const max = bounds?.max ?? undefined
  const isInvalid = start !== null && end !== null && start > end
  return (
    <div className="filter range">
      <span className="filter-label">
        <Icon name="calendar" size={14} />
        {note ? <Hint text={note}>{label}</Hint> : label}
        {isAI && <span className="ai-pill">{tc('ai_tag')}</span>}
      </span>
      <div className="range-inputs">
        <input type="date" className={`sel${isInvalid ? ' invalid' : ''}`} aria-label={`${label}: ${t('from')}`} aria-invalid={isInvalid} min={min} max={end ?? max} value={start ?? ''} onChange={(e) => onChange(e.target.value || null, end)} />
        <span aria-hidden="true">–</span>
        <input type="date" className={`sel${isInvalid ? ' invalid' : ''}`} aria-label={`${label}: ${t('to')}`} aria-invalid={isInvalid} min={start ?? min} max={max} value={end ?? ''} onChange={(e) => onChange(start, e.target.value || null)} />
        {(start || end) && (
          <button type="button" className="icon-btn" aria-label={t('range_clear', { k: label })} title={t('range_clear', { k: label })} onClick={() => onChange(null, null)}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
