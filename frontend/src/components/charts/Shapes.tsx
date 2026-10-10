// The less common shapes: funnel, treemap, radar and sankey.
import { Funnel as ReFunnel, FunnelChart, LabelList, Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar as ReRadar, RadarChart, ResponsiveContainer, Sankey as ReSankey, Tooltip, Treemap as ReTreemap } from 'recharts'
import { sankey, shape } from '../../lib/chartData'
import type { ChartSpec } from '../../lib/types'
import { CHART_HEIGHT } from './Cartesian'
import { SERIES, useTip } from './shared'

const HEIGHT = CHART_HEIGHT + 60

export function Funnel({ spec }: { spec: ChartSpec }) {
  const tip = useTip()
  const data = spec.rows.map((r, i) => ({ ...r, fill: SERIES[i % SERIES.length] }))
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <FunnelChart>
        <Tooltip {...tip} />
        <ReFunnel dataKey={spec.y[0]} nameKey={spec.x} data={data} isAnimationActive={false}>
          <LabelList position="center" dataKey={spec.x} fill="#fff" stroke="none" fontSize={12} fontWeight={700} />
        </ReFunnel>
      </FunnelChart>
    </ResponsiveContainer>
  )
}

type CellProps = { x?: number; y?: number; width?: number; height?: number; index?: number; name?: string; depth?: number }
function TreeCell({ x = 0, y = 0, width = 0, height = 0, index = 0, name = '', depth = 0 }: CellProps) {
  if (depth !== 1) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={SERIES[index % SERIES.length]} stroke="var(--card)" strokeWidth={2} rx={4} />
      {width > 56 && height > 22 && <text x={x + 6} y={y + 16} fill="#fff" fontSize={11} fontWeight={700}>{name}</text>}
    </g>
  )
}

export function Treemap({ spec }: { spec: ChartSpec }) {
  const tip = useTip()
  const data = spec.rows.map((r) => ({ name: String(r[spec.x]), value: Number(r[spec.y[0]] ?? 0) }))
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <ReTreemap data={data} dataKey="value" nameKey="name" isAnimationActive={false} content={<TreeCell />}>
        <Tooltip {...tip} />
      </ReTreemap>
    </ResponsiveContainer>
  )
}

export function Radar({ spec }: { spec: ChartSpec }) {
  const tip = useTip()
  const { rows, y } = shape(spec)
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <RadarChart data={rows} outerRadius="72%">
        <PolarGrid stroke="var(--grid)" />
        <PolarAngleAxis dataKey={spec.x} tick={{ fill: 'var(--mute)', fontSize: 11 }} />
        <PolarRadiusAxis tick={{ fill: 'var(--mute)', fontSize: 10 }} axisLine={false} />
        <Tooltip {...tip} />
        {y.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {y.map((c, i) => (
          <ReRadar key={c} dataKey={c} stroke={SERIES[i]} fill={SERIES[i]} fillOpacity={0.2} isAnimationActive={false} />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  )
}

type NodeProps = { x?: number; y?: number; width?: number; height?: number; index?: number; payload?: { name?: string } }
function SankeyNode({ x = 0, y = 0, width = 0, height = 0, index = 0, payload }: NodeProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={SERIES[index % SERIES.length]} rx={2} />
      <text x={x + width + 6} y={y + height / 2} dominantBaseline="middle" fill="var(--ink2)" fontSize={11}>{payload?.name}</text>
    </g>
  )
}

export function Sankey({ spec }: { spec: ChartSpec }) {
  const tip = useTip()
  const data = sankey(spec.rows, spec.x, spec.series ?? '', spec.y[0])
  return (
    <ResponsiveContainer width="100%" height={HEIGHT + 40}>
      <ReSankey data={data} nodePadding={18} nodeWidth={10} margin={{ top: 8, right: 90, left: 8, bottom: 8 }} node={<SankeyNode />} link={{ stroke: 'var(--line3)', strokeOpacity: 0.6 }}>
        <Tooltip {...tip} />
      </ReSankey>
    </ResponsiveContainer>
  )
}
