// A pie of up to 6 slices: the biggest ones, the rest gathered as "Other".
import { Cell, Legend, Pie as RePie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useMessages } from '../../i18n'
import { chart as chartMsg } from '../../i18n/chart'
import { slices } from '../../lib/chartData'
import type { ChartSpec } from '../../lib/types'
import { CHART_HEIGHT } from './Cartesian'
import { SERIES, useTip } from './shared'

export function Pie({ spec }: { spec: ChartSpec }) {
  const t = useMessages(chartMsg)
  const tip = useTip()
  const data = slices(spec.rows, spec.x, spec.y[0], t('other'))
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <PieChart>
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <RePie isAnimationActive={false} data={data} dataKey={spec.y[0]} nameKey={spec.x} innerRadius="45%" outerRadius="80%" stroke="var(--card)" strokeWidth={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i]} />
          ))}
        </RePie>
      </PieChart>
    </ResponsiveContainer>
  )
}
