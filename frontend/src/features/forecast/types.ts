export type Metric = 'orders' | 'units'
export type MethodName = 'moving_average' | 'ses' | 'linear_trend'
export type Point = { ym: string; mid: number; lo: number; hi: number }
/** One method's own forecast: what picking it in the chart shows. */
export type Method = { name: MethodName; wape: number | null; mae: number | null; params: Params; sd: number; points: Point[]; inventory: Inventory | null }
export type Params = { window?: number; alpha?: number; slope?: number }
export type Inventory = { service: number; z: number; planned: number; safety: number; total: number; months: number }

/** GET /api/forecast. `wape` is a fraction (0.17 = 17%). */
export type ForecastData = {
  metric: Metric
  horizon: number
  category: string | null
  sku: string | null
  history: number[]
  history_start: string // 'YYYY-MM' of history[0]
  points: Point[]
  method: MethodName
  params: Params
  sd: number
  methods: Method[]
  naive: { wape: number | null; mae: number | null }
  inventory: Inventory | null
}
