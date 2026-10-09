// A chart the AI asked for (bar/line/pie/table) from query rows. Color follows the series, never its rank.
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMessages } from '../i18n'
import { chart as chartMsg } from '../i18n/chart'
import { useFormat } from '../i18n/format'
import { pickedRows } from '../lib/highlight'
import type { ChartSpec } from '../lib/types'

const MARK = 'var(--series-2)' // the color of highlighted bars; the series itself is series-1
const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)']

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
  const fmt = useFormat()
  // A pie past 6 slices can't be read; fall back to bars.
  const type = spec.type === 'pie' && spec.rows.length > 6 ? 'bar' : spec.type
  const axis = { tickLine: false, axisLine: false, tick: { fill: 'var(--mute)', fontSize: 11 } }
  const tip = { contentStyle: { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }, formatter: (v: unknown) => fmt.value(v) }
  const multi = spec.y.length > 1
  const picked = type === 'bar' && !multi && spec.highlight ? pickedRows(spec.rows, spec.y[0], spec.highlight) : null

  let chart = null
  if (type === 'bar')
    chart = (
      <BarChart data={spec.rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey={spec.x} {...axis} />
        <YAxis {...axis} />
        <Tooltip cursor={{ fill: 'var(--soft)' }} {...tip} />
        {multi && <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />}
        {spec.y.map((y, i) => (
          <Bar key={y} isAnimationActive={false} dataKey={y} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={24}>
            {picked && spec.rows.map((_, r) => <Cell key={r} fill={picked.has(r) ? MARK : SERIES[i]} />)}
          </Bar>
        ))}
      </BarChart>
    )
  if (type === 'line')
    chart = (
      <LineChart data={spec.rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey={spec.x} {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tip} />
        {multi && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {spec.y.map((y, i) => (
          <Line key={y} isAnimationActive={false} dataKey={y} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)', fill: SERIES[i] }} />
        ))}
      </LineChart>
    )
  if (type === 'pie')
    chart = (
      <PieChart>
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Pie isAnimationActive={false} data={spec.rows} dataKey={spec.y[0]} nameKey={spec.x} innerRadius="45%" outerRadius="80%" stroke="var(--card)" strokeWidth={2}>
          {spec.rows.map((_, i) => (
            <Cell key={i} fill={SERIES[i]} />
          ))}
        </Pie>
      </PieChart>
    )

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
      {picked && spec.highlight && !showTable && (
        <p className="xsmall mark-note"><span className="mark-dot" aria-hidden="true" />{t(spec.highlight.mode, { n: spec.highlight.n })}</p>
      )}
      {chart && !showTable ? (
        <ResponsiveContainer width="100%" height={220}>
          {chart}
        </ResponsiveContainer>
      ) : (
        <DataTable spec={spec} />
      )}
    </figure>
  )
}
