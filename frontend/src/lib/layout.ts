// Where a dashboard widget sits in a 12-column row: how many columns it takes. The AI sets `span` when the user asks for a layout;
// otherwise a KPI takes a third of a row (three side by side) and a chart a whole row.
export const COLUMNS = 12
const MIN = { kpi: 2, chart: 4 } as const // narrower is not readable
const DEFAULT = { kpi: 4, chart: 12 } as const

/** The columns a widget takes: its own span tidied into the readable range, or the default for its kind. */
export function spanOf(w: { kind: 'kpi' | 'chart'; span?: number }): number {
  if (typeof w.span !== 'number' || !Number.isFinite(w.span)) return DEFAULT[w.kind]
  return Math.max(MIN[w.kind], Math.min(COLUMNS, Math.round(w.span)))
}
