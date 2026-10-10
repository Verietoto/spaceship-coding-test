// Bar, horizontal bar, stacked bar, area, line, combo (bars + lines on the right axis) and histogram: one recharts chart, told apart by `type`.
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMessages } from '../../i18n'
import { chart as chartMsg } from '../../i18n/chart'
import { useFormat } from '../../i18n/format'
import { shape } from '../../lib/chartData'
import { pickedRows } from '../../lib/highlight'
import type { ChartSpec } from '../../lib/types'
import { AXIS, MARK, SERIES, useTip } from './shared'

const ROW_HEIGHT = 28 // a horizontal bar chart grows with its rows
export const CHART_HEIGHT = 220

export function Cartesian({ spec }: { spec: ChartSpec }) {
  const t = useMessages(chartMsg)
  const fmt = useFormat()
  const tip = useTip()
  const { rows, y, line } = shape(spec)
  const type = spec.type
  const horizontal = type === 'hbar'
  const multi = y.length + line.length > 1
  const bars = type === 'bar' || horizontal || type === 'stacked_bar' || type === 'histogram' || type === 'combo'
  const picked = (type === 'bar' || horizontal) && y.length === 1 && !spec.series && spec.highlight ? pickedRows(rows, y[0], spec.highlight) : null
  const goal = spec.target != null && (
    <ReferenceLine
      {...(horizontal ? { x: spec.target } : { y: spec.target, yAxisId: 'l' })}
      stroke="var(--ink2)"
      strokeDasharray="5 4"
      label={{ value: t('target', { v: fmt.value(spec.target) }), position: horizontal ? 'top' : type === 'combo' ? 'insideTopRight' : 'right', fill: 'var(--ink2)', fontSize: 11 }}
    />
  )
  return (
    <>
      {picked && spec.highlight && (
        <p className="xsmall mark-note"><span className="mark-dot" aria-hidden="true" />{t(spec.highlight.mode, { n: spec.highlight.n })}</p>
      )}
      <ResponsiveContainer width="100%" height={horizontal ? Math.max(CHART_HEIGHT, rows.length * ROW_HEIGHT + 40) : CHART_HEIGHT}>
      <ComposedChart
        data={rows}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: spec.target != null && horizontal ? 22 : 8, right: type === 'combo' ? 0 : spec.target != null && !horizontal ? 60 : 8, left: horizontal ? 8 : -8, bottom: 0 }}
        barCategoryGap={type === 'histogram' ? 1 : undefined}
      >
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--grid)" />
        {horizontal ? (
          <>
            <XAxis type="number" {...AXIS} />
            <YAxis type="category" dataKey={spec.x} width={90} {...AXIS} />
          </>
        ) : (
          <>
            <XAxis dataKey={spec.x} {...AXIS} />
            <YAxis yAxisId="l" {...AXIS} />
            {type === 'combo' && <YAxis yAxisId="r" orientation="right" {...AXIS} />}
          </>
        )}
        <Tooltip cursor={{ fill: 'var(--soft)' }} {...tip} />
        {multi && <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />}
        {y.map((c, i) =>
          bars ? (
            <Bar
              key={c}
              yAxisId={horizontal ? undefined : 'l'}
              isAnimationActive={false}
              dataKey={c}
              fill={SERIES[i]}
              stackId={type === 'stacked_bar' ? 's' : undefined}
              radius={type === 'histogram' || type === 'stacked_bar' ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={type === 'histogram' ? undefined : 24}
            >
              {picked && rows.map((_, r) => <Cell key={r} fill={picked.has(r) ? MARK : SERIES[i]} />)}
            </Bar>
          ) : type === 'area' ? (
            <Area key={c} yAxisId="l" isAnimationActive={false} type="monotone" dataKey={c} stroke={SERIES[i]} fill={SERIES[i]} fillOpacity={0.22} strokeWidth={2} />
          ) : (
            <Line key={c} yAxisId="l" isAnimationActive={false} dataKey={c} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)', fill: SERIES[i] }} />
          ),
        )}
        {line.map((c, i) => (
          <Line key={c} yAxisId="r" isAnimationActive={false} dataKey={c} stroke={SERIES[y.length + i]} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: 'var(--card)', fill: SERIES[y.length + i] }} />
        ))}
        {goal}
      </ComposedChart>
      </ResponsiveContainer>
    </>
  )
}
