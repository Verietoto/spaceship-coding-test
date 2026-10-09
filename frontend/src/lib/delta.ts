// Port of the prototype's deltaInfo: change vs a comparison, as relative %, percentage points, or days.
export type DeltaKind = 'rel' | 'pt' | 'd'
export type Delta = { value: number; kind: DeltaKind; tone: 'good' | 'bad' | 'neutral' }

export function delta(cur: number | null, base: number | null, kind: DeltaKind, bad?: 'up' | 'down'): Delta | null {
  if (cur == null || base == null) return null
  if (kind === 'rel' && base === 0) return null
  const value = kind === 'rel' ? ((cur - base) / base) * 100 : cur - base
  let tone: Delta['tone'] = 'neutral'
  if (bad && Math.abs(value) >= 0.05) tone = (bad === 'up' && value > 0) || (bad === 'down' && value < 0) ? 'bad' : 'good'
  return { value, kind, tone }
}
