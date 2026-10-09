import { describe, expect, it } from 'vitest'
import { forecastRows } from '../../src/lib/forecastRows'

const points = [
  { ym: '2026-01', mid: 25, lo: 12, hi: 37 },
  { ym: '2026-02', mid: 25, lo: 7, hi: 42 },
]

describe('forecastRows', () => {
  const rows = forecastRows([10, 20, 30], '2025-10', points)

  it('lists the history month by month, then the months ahead', () => {
    expect(rows.map((r) => r.ym)).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('keeps actuals on the history and the range only on the months ahead', () => {
    expect(rows.slice(0, 3).map((r) => r.actual)).toEqual([10, 20, 30])
    expect(rows.slice(3).map((r) => r.actual)).toEqual([null, null])
    expect(rows.slice(0, 3).every((r) => r.band === null)).toBe(true)
    expect(rows[3].band).toEqual([12, 37])
  })

  it('starts the forecast line on the last actual month so the lines meet', () => {
    expect(rows.map((r) => r.forecast)).toEqual([null, null, 30, 25, 25])
  })

  it('puts a bar under the months ahead only, never under the history', () => {
    expect(rows.map((r) => r.ahead)).toEqual([null, null, null, 25, 25])
  })

  it('has no forecast line without months ahead', () => {
    expect(forecastRows([5], '2025-01', []).map((r) => r.forecast)).toEqual([5])
  })
})
