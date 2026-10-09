// Renders dashboard widgets (KPI or chart) with their calc trace; a failed widget shows its error.
import type { CSSProperties } from 'react'
import { CalcTrace } from '../../components/CalcTrace'
import { DynamicChart } from '../../components/DynamicChart'
import { useMessages } from '../../i18n'
import { builder } from '../../i18n/builder'
import { common } from '../../i18n/common'
import { useFormat } from '../../i18n/format'
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
    const value = { usd: fmt.usd(raw), pct: fmt.pct1(raw), days: fmt.days(raw), number: fmt.int(raw == null ? raw : Math.round(raw * 10) / 10) }[w.format ?? 'number']
    return (
      <div className="card widget kpi" style={cell} data-span={span}>
        <div className="kpi-label">{w.title}</div>
        <div className="kpi-value">{value}</div>
        {trace}
      </div>
    )
  }
  const spec: ChartSpec = { type: w.chart_type ?? 'bar', x: w.x ?? '', y: w.y ?? [], title: w.title, rows: w.rows, sql: w.sql, highlight: w.highlight }
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
