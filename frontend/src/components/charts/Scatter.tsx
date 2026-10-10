// Scatter: two numeric columns as points; `series` colors them by a category, `size` makes them bubbles.
import { CartesianGrid, Legend, ResponsiveContainer, Scatter as ReScatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { scatterGroups } from '../../lib/chartData'
import type { ChartSpec } from '../../lib/types'
import { CHART_HEIGHT } from './Cartesian'
import { AXIS, SERIES, useTip } from './shared'

export function Scatter({ spec }: { spec: ChartSpec }) {
  const tip = useTip()
  const groups = scatterGroups(spec.rows, spec.series)
  const y = spec.y[0]
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT + 20}>
      <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="var(--grid)" />
        <XAxis type="number" dataKey={spec.x} name={spec.x} {...AXIS} />
        <YAxis type="number" dataKey={y} name={y} {...AXIS} />
        {spec.size && <ZAxis type="number" dataKey={spec.size} name={spec.size} range={[50, 420]} />}
        <Tooltip cursor={{ strokeDasharray: '4 4' }} {...tip} />
        {groups.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {groups.map((g, i) => (
          <ReScatter key={g.name} name={g.name || y} data={g.rows} fill={SERIES[i]} fillOpacity={0.75} isAnimationActive={false} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}
