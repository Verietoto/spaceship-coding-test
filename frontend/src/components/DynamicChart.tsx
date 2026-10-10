// A chart the AI asked for, from query rows: picks the drawing for its type (components/charts/) and offers the rows as a table.
import { useState } from 'react'
import { useFormat } from '../i18n/format'
import { useMessages } from '../i18n'
import { chart as chartMsg } from '../i18n/chart'
import type { ChartSpec } from '../lib/types'
import { Cartesian } from './charts/Cartesian'
import { Heat } from './charts/Heat'
import { Pie } from './charts/Pie'
import { Scatter } from './charts/Scatter'
import { Funnel, Radar, Sankey, Treemap } from './charts/Shapes'

function DataTable({ spec }: { spec: ChartSpec }) {
  const fmt = useFormat()
  const cols = spec.rows.length ? Object.keys(spec.rows[0]) : []
  return (
    <div className="table-wrap chart-table">
      <table>
        <thead>
          <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {spec.rows.slice(0, 50).map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c} className={typeof r[c] === 'number' ? 'num' : ''}>{fmt.value(r[c])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DynamicChart({ spec }: { spec: ChartSpec }) {
  const [showTable, setShowTable] = useState(spec.type === 'table')
  const t = useMessages(chartMsg)
  const drawings = { pie: Pie, heatmap: Heat, scatter: Scatter, funnel: Funnel, treemap: Treemap, radar: Radar, sankey: Sankey } as const
  const Drawing = spec.type === 'table' ? null : (drawings as Partial<Record<string, typeof Pie>>)[spec.type] ?? Cartesian
  const chart = Drawing && <Drawing spec={spec} />
  return (
    <figure className="dyn-chart">
      <figcaption className="row">
        <strong className="small">{spec.title}</strong>
        {chart && (
          <button type="button" className="link xsmall" onClick={() => setShowTable(!showTable)}>
            {showTable ? t('show_chart') : t('show_table')}
          </button>
        )}
      </figcaption>
      {chart && !showTable ? chart : <DataTable spec={spec} />}
    </figure>
  )
}
