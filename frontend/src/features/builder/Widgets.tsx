// Renders dashboard widgets (KPI or chart) with their calc trace; a failed widget shows its error.
import type { CSSProperties } from 'react'
import { CalcTrace } from '../../components/CalcTrace'
import { DynamicChart } from '../../components/DynamicChart'
import { useMessages } from '../../i18n'
import { builder } from '../../i18n/builder'
import { common } from '../../i18n/common'
import { useFormat } from '../../i18n/format'
import { targetState } from '../../lib/kpiTarget'
import { spanOf } from '../../lib/layout'
import type { ChartSpec, Highlight } from '../../lib/types'

export type Widget = {
  kind: 'kpi' | 'chart'
  title: string
  sql: string
  formulas: string[]
  format?: 'number' | 'usd' | 'pct' | 'days'
  chart_type?: ChartSpec['type']
  x?: string
  y?: string[]
  series?: string
  y_line?: string[]
  size?: string
  target?: number // a chart's goal line, or the goal a kpi is judged against
  better?: 'high' | 'low' // kpi with a target: which direction is good
  highlight?: Highlight
  span?: number // columns of a 12-column row; see lib/layout.ts
  rows: Record<string, unknown>[]
  error?: string
}

function WidgetView({ w }: { w: Widget }) {
  const t = useMessages(builder)
  const tc = useMessages(common)
  const fmt = useFormat()
  const span = spanOf(w)
  const cell = { '--span': span } as CSSProperties // how wide the widget is; the grid in styles reads it
  const trace = <CalcTrace calc={{ metrics: [], formulas: w.formulas, sql: w.sql }} label={tc('ai_calc')} />
  if (w.error)
    return (
      <div className="card widget" style={cell} data-span={span}>
        <strong className="small">{w.title}</strong>
        <p className="note bad small">{t('widget_error', { e: w.error })}</p>
      </div>
    )
  if (w.kind === 'kpi') {
    const first = w.rows[0] ?? {}
    const raw = Object.values(first).find((v) => typeof v === 'number') as number | undefined
    const show = (v: number | undefined) => ({ usd: fmt.usd(v), pct: fmt.pct1(v), days: fmt.days(v), number: fmt.int(v == null ? v : Math.round(v * 10) / 10) })[w.format ?? 'number']
    const value = show(raw)
    const goal = w.target != null ? targetState(raw, w.target, w.better) : null
    return (
      <div className="card widget kpi" style={cell} data-span={span}>
        <div className="kpi-label">{w.title}</div>
        <div className={`kpi-value${goal && !goal.met ? ' bad' : ''}`}>{value}</div>
        {goal && w.target != null && (
          <div className={`kpi-goal${goal.met ? ' met' : ''}`}>
            <span className="kpi-goal-bar" aria-hidden="true"><span style={{ width: `${goal.pct}%` }} /></span>
            <span>{t(goal.met ? 'kpi_goal_met' : 'kpi_goal_not_met', { v: show(w.target) })}</span>
          </div>
        )}
        {trace}
      </div>
    )
  }
  const spec: ChartSpec = { type: w.chart_type ?? 'bar', x: w.x ?? '', y: w.y ?? [], title: w.title, rows: w.rows, sql: w.sql, highlight: w.highlight, series: w.series, y_line: w.y_line, size: w.size, target: w.target }
  return (
    <div className="card widget chart" style={cell} data-span={span}>
      <DynamicChart spec={spec} />
      {trace}
    </div>
  )
}

export function Widgets({ widgets }: { widgets: Widget[] }) {
  return (
    <div className="widget-grid">
      {widgets.map((w, i) => (
        <WidgetView key={`${i}-${w.title}`} w={w} />
      ))}
    </div>
  )
}
