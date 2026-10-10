// What every chart shares: the palette (color follows the series, never its rank), axis style and tooltip.
import { useFormat } from '../../i18n/format'

export const MARK = 'var(--series-2)' // the color of highlighted bars; the series itself is series-1
export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)']
export const AXIS = { tickLine: false, axisLine: false, tick: { fill: 'var(--mute)', fontSize: 11 } }

export function useTip() {
  const fmt = useFormat()
  return { contentStyle: { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }, formatter: (v: unknown) => fmt.value(v) }
}
