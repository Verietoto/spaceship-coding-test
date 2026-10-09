// Shapes shared across the app: filters/view state and API responses used by more than one feature.
/** Filters that pick values: any number of them, or "all except". Each is a column of the orders. */
export const DIMENSIONS = ['region', 'warehouse', 'carrier', 'client', 'category', 'status', 'promo', 'origin', 'destination', 'sku'] as const
export type Dimension = (typeof DIMENSIONS)[number]
/** Filters that bound a number: order value (USD), items ordered, lead time and order age (days). */
export const RANGE_KEYS = ['value', 'quantity', 'lead', 'age'] as const
export type RangeKey = (typeof RANGE_KEYS)[number]
/** [lowest, highest], either may be open (null); both inclusive. */
export type Bounds = [number | null, number | null]
/** A date range (ISO dates, null = open), value lists per dimension (empty = all, or everything except them), number ranges and the
 * arrival date range. The same shape the API sends and takes (Filters.as_dict in the backend). */
export type Filters = {
  start: string | null
  end: string | null
  arrived_start: string | null
  arrived_end: string | null
  ranges: Partial<Record<RangeKey, Bounds>>
  exclude: Dimension[] // dimensions whose list means "everything except these"
} & Record<Dimension, string[]>
/** What the AI can have set (shown as an "AI" tag): the date range, a dimension, or the comparison. */
export type AIKey = Dimension | RangeKey | 'period' | 'arrived' | 'compare'
/** A filter a saved dashboard offers, chosen by the agent that built it, with what it starts on. */
export type DashFilter = { key: 'period' | 'arrived' | Dimension | RangeKey; default?: string[]; start?: string; end?: string; min?: number; max?: number }
export type Compare = 'prev' | 'base' | 'none'
export type Section = 'overview' | 'delivery' | 'clients' | 'risk' | 'forecast' | 'quality' | 'reports' | 'knowledge' | 'backoffice' | 'build' | 'saved'
export type DashboardSection = Exclude<Section, 'build' | 'saved' | 'backoffice'>
export type Meta = {
  regions: string[]
  carriers: string[]
  warehouses: Record<string, string>
  clients: string[]
  categories: string[]
  total: number
  bounds: { min: string; max: string }
  years: number[]
}
export type FacetValue = { value: string; n: number; region?: string }
export type Facets = {
  total: number
  bounds: { min: string; max: string }
  years: number[]
  /** The lowest and highest value in the data of each number range (and the first and last arrival date), for placeholders. */
  ranges: Record<RangeKey, { min: number | null; max: number | null }> & { arrived: { min: string | null; max: string | null } }
} & Record<Dimension, FacetValue[]>
export type Calc = {
  filters?: Filters // absent for builder widgets, whose SQL carries its own scope
  rows?: number
  total?: number
  metrics: string[]
  sql: string // kept for audit; the UI shows the formulas, not the query
  result?: Record<string, unknown>
  terms?: Record<string, Record<string, number | null>> // the numbers behind each metric (num, den, value ...), for the formula with its values
  formulas?: string[] // math the AI wrote for its own queries, shown after the metrics
}

/** What the view is filtered by, plus which of those values the AI set (shown as an "AI" tag). */
export type View = { f: Filters; compare: Compare; ai: Partial<Record<AIKey, boolean>> }

export const DEFAULT_FILTERS: Filters = {
  start: null, end: null, arrived_start: null, arrived_end: null, ranges: {}, exclude: [],
  region: [], warehouse: [], carrier: [], client: [], category: [], status: [], promo: [], origin: [], destination: [], sku: [],
}

/** Per-group numbers from the backend's STATS block. */
export type Stats = {
  n: number
  val: number
  aov: number | null
  deliv: number | null
  delay_n: number
  delay: number | null
  lead_n: number
  mean: number | null
  p50: number | null
  p90: number | null
  over7: number | null
  stuck: number
  exc: number
  open: number
  prob_n: number
  prob_val: number
  open_val: number
}
export type Keyed = Stats & { key: string }

/** Mark the n highest (top) or lowest (bottom) bars of a one-series bar chart. */
export type Highlight = { mode: 'top' | 'bottom'; n: number }
export type ChartSpec = { type: 'bar' | 'line' | 'pie' | 'table'; x: string; y: string[]; title: string; rows: Record<string, unknown>[]; sql: string; highlight?: Highlight }
