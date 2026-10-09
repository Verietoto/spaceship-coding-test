// The forecast as bars and a line in one chart: a bar per month (actual; faded for the months ahead), the line through them
// (the chosen method's forecast dashed) and its 80% range as a band.
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMessages } from '../../i18n'
import { forecast } from '../../i18n/forecast'
import { useFormat } from '../../i18n/format'
import type { ForecastRow } from '../../lib/forecastRows'

export function ForecastChart({ rows, label }: { rows: ForecastRow[]; label: string }) {
  const fmt = useFormat()
  const axis = { tickLine: false, axisLine: false, tick: { fill: 'var(--mute)', fontSize: 11 } }
  return (
    <div role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="ym" tickFormatter={(ym: string, i: number) => (i === 0 || ym.endsWith('-01') ? fmt.monthYear(ym) : fmt.month(Number(ym.slice(5))))} interval={0} {...axis} tick={{ ...axis.tick, fontSize: 10 }} />
          <YAxis {...axis} tickFormatter={(v: number) => fmt.int(v)} />
          <Tooltip cursor={{ fill: 'var(--soft)' }} content={<Reading />} />
          <Area dataKey="band" stroke="none" fill="var(--line3)" fillOpacity={0.55} isAnimationActive={false} connectNulls />
          <Bar dataKey="actual" fill="var(--bar-good)" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
          <Bar dataKey="ahead" fill="var(--series-1)" fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
          <Line dataKey="actual" stroke="var(--bar-good)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: 'var(--bar-good)' }} isAnimationActive={false} connectNulls={false} />
          <Line dataKey="forecast" stroke="var(--series-1)" strokeWidth={2.5} strokeDasharray="7 5" dot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--card)', fill: 'var(--series-1)' }} isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** One reading per month (actual or forecast with its range), instead of a line for each of the chart's layers. */
function Reading({ active, payload }: { active?: boolean; payload?: { payload: ForecastRow }[] }) {
  const t = useMessages(forecast)
  const fmt = useFormat()
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const future = row.band != null
  return (
    <div className="chart-tip">
      <strong>{fmt.monthYear(row.ym)}</strong>
      {future ? (
        <>
          <div>{t('forecast')}: {fmt.num0(row.forecast)}</div>
          <div className="muted">{t('range')}: {fmt.num0(row.band?.[0] ?? null)}–{fmt.num0(row.band?.[1] ?? null)}</div>
        </>
      ) : (
        <div>{t('actual')}: {fmt.num0(row.actual)}</div>
      )}
    </div>
  )
}
