// What the comparison strip says: one situation out of seven, from the chosen mode and what the backend could actually compare.
import type { Compare } from './types'

export type CompareNote = 'off' | 'range' | 'custom' | 'pick_compare' | 'all' | 'fallback_all' | 'pick_dim' | 'no_earlier' | 'pick_period'

/** `result` is the backend's `compare` block: the mode it really used (it falls back to "base") and the stats it found, if any. */
export function compareNote(chosen: Compare, result: { mode: string; range?: unknown; stats: unknown }, hasPeriod: boolean): CompareNote {
  if (chosen === 'none') return 'off'
  if (chosen === 'custom') return result.range ? 'custom' : 'pick_compare'
  if (result.mode === 'base') {
    if (!result.stats) return 'pick_dim'
    return chosen === 'prev' ? 'fallback_all' : 'all'
  }
  if (result.range) return 'range'
  return hasPeriod ? 'no_earlier' : 'pick_period'
}
