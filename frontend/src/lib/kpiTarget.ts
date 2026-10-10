// A KPI judged against its goal: how far along it is (for the progress bar) and whether it meets the goal.
export type TargetState = { pct: number; met: boolean }

/** `better` says which direction is good: a delay rate (low) meets its target at or under it, orders (high) at or over it. */
export function targetState(value: number | null | undefined, target: number, better: 'high' | 'low' = 'high'): TargetState | null {
  if (value == null || !Number.isFinite(value) || target === 0) return null
  const pct = Math.max(0, Math.min(100, (value / target) * 100))
  return { pct, met: better === 'low' ? value <= target : value >= target }
}
