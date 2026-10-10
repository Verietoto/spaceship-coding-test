// Filters <-> query string (API calls and the shareable page URL) and small helpers on a Filters value.
import { DEFAULT_FILTERS, DIMENSIONS, RANGE_KEYS } from './types'
import type { Bounds, Compare, DateRange, Dimension, Filters, RangeKey } from './types'

type Params = Record<string, string | string[]>

/** Only what differs from "everything": the API and the URL both stay short. */
export function toParams(f: Filters): Params {
  const p: Params = {}
  if (f.start) p.start = f.start
  if (f.end) p.end = f.end
  if (f.arrived_start) p.arrived_start = f.arrived_start
  if (f.arrived_end) p.arrived_end = f.arrived_end
  for (const d of DIMENSIONS) if (f[d].length) p[d] = f[d]
  const ex = f.exclude.filter((d) => f[d].length)
  if (ex.length) p.exclude = ex
  for (const k of RANGE_KEYS) {
    const [lo, hi] = f.ranges[k] ?? [null, null]
    if (lo !== null) p[`${k}_min`] = String(lo)
    if (hi !== null) p[`${k}_max`] = String(hi)
  }
  return p
}

/** The page URL for a view: filters plus a comparison that is not the default. */
export function toSearch(f: Filters, compare: Compare, cmpRange: DateRange | null = null): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(toParams(f))) for (const x of Array.isArray(v) ? v : [v]) qs.append(k, x)
  if (compare !== 'prev') qs.set('compare', compare)
  if (compare === 'custom' && cmpRange) {
    qs.set('cmp_start', cmpRange.start)
    qs.set('cmp_end', cmpRange.end)
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function fromSearch(search: string): { f: Filters; compare: Compare; cmpRange: DateRange | null } {
  const qs = new URLSearchParams(search)
  const date = (k: string) => (ISO.test(qs.get(k) ?? '') ? qs.get(k) : null)
  const number = (k: string) => {
    const raw = qs.get(k)
    return raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null
  }
  const f: Filters = { ...DEFAULT_FILTERS, start: date('start'), end: date('end'), arrived_start: date('arrived_start'), arrived_end: date('arrived_end'), ranges: {} }
  for (const k of RANGE_KEYS) {
    const bounds: Bounds = [number(`${k}_min`), number(`${k}_max`)]
    if (bounds[0] !== null || bounds[1] !== null) f.ranges[k] = bounds
  }
  for (const d of DIMENSIONS) f[d] = qs.getAll(d).filter(Boolean)
  f.exclude = qs.getAll('exclude').filter((d): d is Dimension => (DIMENSIONS as readonly string[]).includes(d) && f[d as Dimension].length > 0)
  const c = qs.get('compare')
  const [cs, ce] = [date('cmp_start'), date('cmp_end')]
  const compare: Compare = c === 'base' || c === 'none' || c === 'custom' ? c : 'prev'
  return { f, compare, cmpRange: compare === 'custom' && cs && ce && cs <= ce ? { start: cs, end: ce } : null }
}

export function isDefault(f: Filters): boolean {
  return !f.start && !f.end && !f.arrived_start && !f.arrived_end && Object.keys(f.ranges).length === 0 && DIMENSIONS.every((d) => f[d].length === 0)
}

/** Sets (or, with both ends open, removes) one number range. */
export function withRange(f: Filters, key: RangeKey, lo: number | null, hi: number | null): Filters {
  const { [key]: _old, ...rest } = f.ranges
  return { ...f, ranges: lo === null && hi === null ? rest : { ...rest, [key]: [lo, hi] } }
}

/** How many filters beyond the ones the bar always shows (period, region, warehouse, carrier, client) are set. */
export function extraCount(f: Filters): number {
  const shown: readonly string[] = ['region', 'warehouse', 'carrier', 'client']
  return DIMENSIONS.filter((d) => !shown.includes(d) && f[d].length).length + Object.keys(f.ranges).length + (f.arrived_start || f.arrived_end ? 1 : 0)
}

/** Sets one dimension's list; dropping the last value also drops its exclude flag. */
export function withValues(f: Filters, dim: Dimension, values: string[], exclude: boolean): Filters {
  const keep = f.exclude.filter((d) => d !== dim)
  return { ...f, [dim]: values, exclude: exclude && values.length ? [...keep, dim] : keep }
}

/** True when `value` is the only thing selected for the dimension (and it is included, not excluded). */
export function isOnly(f: Filters, dim: Dimension, value: string): boolean {
  return f[dim].length === 1 && f[dim][0] === value && !f.exclude.includes(dim)
}

/** File-name friendly description of a view, e.g. 2025-10-01_2025-12-31_UPS_FedEx. */
export function slug(f: Filters): string {
  const parts = [f.start, f.end]
  for (const d of DIMENSIONS) if (f[d].length) parts.push(...(f.exclude.includes(d) ? ['not'] : []), ...f[d].map((v) => v.replace(/[^A-Za-z0-9-]+/g, '-')))
  for (const k of RANGE_KEYS) if (f.ranges[k]) parts.push(`${k}${f.ranges[k]?.[0] ?? ''}-${f.ranges[k]?.[1] ?? ''}`)
  if (f.arrived_start || f.arrived_end) parts.push(`arrived${f.arrived_start ?? ''}-${f.arrived_end ?? ''}`)
  return parts.filter(Boolean).join('_') || 'all'
}
