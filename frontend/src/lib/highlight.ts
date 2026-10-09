// Which rows of a one-series bar chart carry the highlight: the n with the highest (top) or lowest (bottom) value.
import type { Highlight } from './types'

/** Row indexes to highlight. Rows whose value is not a number never count; equal values go in row order. */
export function pickedRows(rows: Record<string, unknown>[], key: string, { mode, n }: Highlight): Set<number> {
  const numeric = rows.flatMap((r, i) => (typeof r[key] === 'number' ? [{ i, v: r[key] as number }] : []))
  numeric.sort((a, b) => (mode === 'top' ? b.v - a.v : a.v - b.v) || a.i - b.i)
  return new Set(numeric.slice(0, n).map((x) => x.i))
}
