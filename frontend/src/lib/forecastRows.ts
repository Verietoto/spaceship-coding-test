// The rows of the forecast line chart: every month of history, then the months ahead with their 80% range.
import { addMonths } from './period'

export type ForecastPoint = { ym: string; mid: number; lo: number; hi: number }
/** `ahead` is the forecast of the months to come only (the bars); `forecast` is the line, which also starts on the last actual month. */
export type ForecastRow = { ym: string; actual: number | null; forecast: number | null; ahead: number | null; band: [number, number] | null }

/** `start` is the month of history[0] ("YYYY-MM"). The forecast line starts on the last actual month, so the two lines meet. */
export function forecastRows(history: number[], start: string, points: ForecastPoint[]): ForecastRow[] {
  const last = history.length - 1
  return [
    ...history.map((v, i) => ({ ym: addMonths(start, i), actual: v, forecast: i === last ? v : null, ahead: null, band: null })),
    ...points.map((p) => ({ ym: p.ym, actual: null, forecast: p.mid, ahead: p.mid, band: [p.lo, p.hi] as [number, number] })),
  ]
}
