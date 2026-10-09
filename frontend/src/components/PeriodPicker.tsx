// Period filter: all data, a preset of any year in the data (year, half, quarter, month), or a custom date range.
// A button opening a scrollable list grouped by year (a native <select> is awkward to scroll with this many options).
import { useRef, useState } from 'react'
import { useApp } from '../app/useApp'
import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { filters as filtersMsg } from '../i18n/filters'
import { useFormat } from '../i18n/format'
import { matchPreset, presetRange, presetsFor } from '../lib/period'
import type { PresetCode } from '../lib/period'
import { DatePicker } from './DatePicker'
import { Icon } from './Icon'
import { useDismiss } from './useDismiss'

type Range = { start: string | null; end: string | null }
/** Without `value`/`onChange` it is the global period filter; a dashboard's own filter bar passes its own. */
type Props = { years: number[]; bounds: { min: string; max: string }; value?: Range; onChange?: (start: string | null, end: string | null) => void }

export function PeriodPicker({ years, bounds, value, onChange }: Props) {
  const app = useApp()
  const setRange = onChange ?? app.setRange
  const isAI = !value && app.view.ai.period // the AI tag belongs to the main view only
  const t = useMessages(filtersMsg)
  const tc = useMessages(common)
  const fmt = useFormat()
  const { start, end } = value ?? app.view.f
  const [isOpen, setOpen] = useState(false)
  const [wantsCustom, setWantsCustom] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useDismiss(root, isOpen, () => setOpen(false))

  const match = matchPreset(start, end)
  const isAll = !start && !end
  const isCustom = wantsCustom || (!isAll && !match)
  const presets = presetsFor(years, bounds)
  const summary = isCustom ? t('custom_range') : fmt.range(start, end)

  const choose = (s: string | null, e: string | null, custom = false) => {
    setWantsCustom(custom)
    setRange(s, e)
    setOpen(false)
  }
  // Moving one end past the other drags the other along, so the range is never empty.
  const onStart = (s: string) => s && setRange(s, end && end < s ? s : end)
  const onEnd = (e: string) => e && setRange(start && start > e ? e : start, e)

  return (
    <div className={`filter period${isCustom ? ' custom' : ''}`} ref={root}>
      <span className="filter-label">
        <Icon name="calendar" size={14} />
        {tc('f_period')}
        {isAI && <span className="ai-pill">{tc('ai_tag')}</span>}
      </span>
      <button
        type="button"
        className={`sel multi-btn${isAI ? ' is-ai' : ''}${isAll ? '' : ' has-value'}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
      >
        <span className="ellipsis">{summary}</span>
        <Icon name="chevron" size={14} />
      </button>
      {isOpen && (
        <div className="popover card multi-panel period-panel" role="dialog" aria-label={tc('f_period')}>
          <div className="period-list">
            <button type="button" className="period-opt" aria-pressed={isAll && !isCustom} onClick={() => choose(null, null)}>
              {tc('period_all')}
            </button>
            {[...years].reverse().map((y) => (
              <div key={y} role="group" aria-label={String(y)}>
                <div className="nav-label">{y}</div>
                <div className="period-grid">
                  {presets.filter((p) => p.year === y).map((p) => {
                    const [s, e] = presetRange(p.code as PresetCode, y)
                    return (
                      <button key={p.code} type="button" className="period-opt" aria-pressed={!isCustom && match?.year === y && match.code === p.code} onClick={() => choose(s, e)}>
                        {fmt.presetOption(p.code)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="period-opt custom-opt" aria-pressed={isCustom} onClick={() => choose(start ?? bounds.min, end ?? bounds.max, true)}>
            {t('custom_range')}
          </button>
        </div>
      )}
      {isCustom && (
        <div className="date-range">
          <DatePicker label={t('from')} value={start} min={bounds.min} max={bounds.max} onChange={onStart} />
          <span aria-hidden="true">–</span>
          <DatePicker label={t('to')} value={end} min={bounds.min} max={bounds.max} alignRight onChange={onEnd} />
        </div>
      )}
    </div>
  )
}
