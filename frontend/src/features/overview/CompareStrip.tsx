// One line above the KPI cards that says what is compared with what, holds the switch, and, when there is nothing to compare, how to get a comparison.
import { useApp } from '../../app/useApp'
import { PeriodPicker } from '../../components/PeriodPicker'
import { Seg } from '../../components/Seg'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { useFormat } from '../../i18n/format'
import { overview } from '../../i18n/overview'
import type { CompareNote } from '../../lib/compareNote'
import { latestRange } from '../../lib/period'
import type { Compare } from '../../lib/types'

const MODES = [['prev', 'cmp_prev'], ['custom', 'cmp_custom'], ['base', 'cmp_base'], ['none', 'cmp_none']] as const

type Props = { note: CompareNote; current: [string | null, string | null]; previous?: [string, string] | null }

export function CompareStrip({ note, current, previous }: Props) {
  const { view, meta, setCompare, setRange } = useApp()
  const bounds = meta?.bounds
  const t = useMessages(overview)
  const tc = useMessages(common)
  const fmt = useFormat()
  const max = meta?.bounds.max
  const text =
    (note === 'range' || note === 'custom') && previous
      ? t('cmp_range', { a: fmt.range(current[0], current[1]), b: fmt.range(previous[0], previous[1]) })
      : t(`cmp_${note === 'custom' ? 'range' : note}`)
  const choose = (c: Compare) => setCompare(c, c === 'custom' && !view.cmpRange && previous ? { start: previous[0], end: previous[1] } : undefined)
  const quick = (kind: 'month' | 'quarter') => {
    if (!max) return
    const [start, end] = latestRange(kind, max)
    setRange(start, end)
  }
  return (
    <div className="cmp-strip">
      <span className="cmp-text">
        {view.ai.compare && <span className="ai-pill">{tc('ai_tag')}</span>} {text}
      </span>
      {note === 'pick_period' && max && (
        <span className="cmp-quick">
          <button type="button" className="btn ghost" onClick={() => quick('month')}>{t('quick_month')}</button>
          <button type="button" className="btn ghost" onClick={() => quick('quarter')}>{t('quick_quarter')}</button>
        </span>
      )}
      {view.compare === 'custom' && bounds && (
        <PeriodPicker
          years={meta?.years ?? []}
          bounds={bounds}
          value={{ start: view.cmpRange?.start ?? null, end: view.cmpRange?.end ?? null }}
          onChange={(start, end) => setCompare('custom', start && end ? { start, end } : null)}
        />
      )}
      <Seg label={t('cmp_label')} value={view.compare} onChange={choose} options={MODES.map(([v, k]) => [v, tc(k)] as [Compare, string])} />
    </div>
  )
}
