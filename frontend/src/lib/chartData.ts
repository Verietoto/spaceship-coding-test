// The rows a chart draws: long format turned into one column per series, and a pie's small slices gathered into one.
import type { ChartSpec } from './types'

type Row = Record<string, unknown>
export const MAX_SERIES = 8 // the palette has this many colors

/** `x, series, value` rows -> one row per x with a column per series, in order of first appearance. Repeated pairs add up; series past the palette are left out. */
export function pivot(rows: Row[], x: string, series: string, value: string): { rows: Row[]; keys: string[] } {
  const keys: string[] = []
  const byX = new Map<string, Row>()
  for (const r of rows) {
    const k = String(r[series])
    if (!keys.includes(k)) keys.push(k)
    if (keys.indexOf(k) >= MAX_SERIES) continue
    const row = byX.get(String(r[x])) ?? { [x]: r[x] }
    const v = typeof r[value] === 'number' ? (r[value] as number) : 0
    row[k] = ((row[k] as number | undefined) ?? 0) + v
    byX.set(String(r[x]), row)
  }
  return { rows: [...byX.values()], keys: keys.slice(0, MAX_SERIES) }
}

/** What the cartesian charts draw: the rows and which columns are bars/areas (`y`) and lines (`line`). */
export function shape(spec: Pick<ChartSpec, 'rows' | 'x' | 'y' | 'series' | 'y_line'>): { rows: Row[]; y: string[]; line: string[] } {
  if (spec.series && spec.y[0]) {
    const p = pivot(spec.rows, spec.x, spec.series, spec.y[0])
    return { rows: p.rows, y: p.keys, line: [] }
  }
  return { rows: spec.rows, y: spec.y.slice(0, MAX_SERIES), line: spec.y_line ?? [] }
}

/** A pie of at most `max` slices: the biggest ones, and everything else as one `other` slice. */
export function slices(rows: Row[], x: string, y: string, other: string, max = 6): Row[] {
  const sorted = [...rows].sort((a, b) => Number(b[y] ?? 0) - Number(a[y] ?? 0))
  if (sorted.length <= max) return rows
  const rest = sorted.slice(max - 1).reduce((s, r) => s + (typeof r[y] === 'number' ? (r[y] as number) : 0), 0)
  return [...sorted.slice(0, max - 1), { [x]: other, [y]: rest }]
}

/** A heatmap's grid: row and column labels in order of first appearance (the biggest grids are cut), each cell's value and its place on the color scale (0..1). */
export const HEAT_MAX_ROWS = 30
export const HEAT_MAX_COLS = 14
export type Heat = { rows: string[]; cols: string[]; cells: Map<string, { value: number; share: number }>; min: number; max: number }

export function heat(rows: Row[], x: string, series: string, y: string): Heat {
  const labels: { rows: string[]; cols: string[] } = { rows: [], cols: [] }
  const sums = new Map<string, number>()
  for (const r of rows) {
    const [a, b] = [String(r[x]), String(r[series])]
    if (typeof r[y] !== 'number') continue
    if (!labels.rows.includes(a)) labels.rows.push(a)
    if (!labels.cols.includes(b)) labels.cols.push(b)
    sums.set(`${a}|${b}`, (sums.get(`${a}|${b}`) ?? 0) + (r[y] as number))
  }
  const rowsCut = labels.rows.slice(0, HEAT_MAX_ROWS)
  const colsCut = labels.cols.slice(0, HEAT_MAX_COLS)
  const kept = [...sums].filter(([k]) => rowsCut.includes(k.split('|')[0]) && colsCut.includes(k.split('|')[1]))
  const values = kept.map(([, v]) => v)
  const [min, max] = values.length ? [Math.min(...values), Math.max(...values)] : [0, 0]
  const cells = new Map(kept.map(([k, value]) => [k, { value, share: max === min ? 0.5 : (value - min) / (max - min) }]))
  return { rows: rowsCut, cols: colsCut, cells, min, max }
}

/** A sankey's nodes and links from `from, to, amount` rows: the biggest flows only, and a node for each side so a name on both sides is not a loop. */
export const SANKEY_MAX_LINKS = 30
export function sankey(rows: Row[], x: string, series: string, y: string): { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] } {
  const sums = new Map<string, number>()
  for (const r of rows) {
    if (typeof r[y] !== 'number' || (r[y] as number) <= 0) continue
    const k = `${String(r[x])}\u0000${String(r[series])}`
    sums.set(k, (sums.get(k) ?? 0) + (r[y] as number))
  }
  const top = [...sums].sort((a, b) => b[1] - a[1]).slice(0, SANKEY_MAX_LINKS)
  const from = [...new Set(top.map(([k]) => k.split('\u0000')[0]))]
  const to = [...new Set(top.map(([k]) => k.split('\u0000')[1]))]
  return {
    nodes: [...from, ...to].map((name) => ({ name })),
    links: top.map(([k, value]) => ({ source: from.indexOf(k.split('\u0000')[0]), target: from.length + to.indexOf(k.split('\u0000')[1]), value })),
  }
}

/** A scatter's points grouped by a category column (one color each); without one, all in a single group. */
export function scatterGroups(rows: Row[], series?: string): { name: string; rows: Row[] }[] {
  if (!series) return [{ name: '', rows }]
  const groups = new Map<string, Row[]>()
  for (const r of rows) groups.set(String(r[series]), [...(groups.get(String(r[series])) ?? []), r])
  return [...groups].slice(0, MAX_SERIES).map(([name, g]) => ({ name, rows: g }))
}
