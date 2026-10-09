/** Axis for a column chart: a readable step for the data, and a top that is a whole number of steps (min two). */
export function niceAxis(values: (number | null | undefined)[], minTop: number): { max: number; step: number } {
  const top = Math.max(minTop, ...values.map((v) => v ?? 0))
  const step = top <= 20 ? 5 : top <= 60 ? 10 : top <= 150 ? 25 : 50
  return { max: Math.max(step * 2, Math.ceil(top / step) * step), step }
}
