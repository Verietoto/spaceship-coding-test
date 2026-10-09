import { describe, expect, it } from 'vitest'
import { spanOf } from '../../src/lib/layout'

describe('spanOf', () => {
  it('gives a KPI a third of a row and a chart a whole row when no layout was asked for', () => {
    expect(spanOf({ kind: 'kpi' })).toBe(4)
    expect(spanOf({ kind: 'chart' })).toBe(12)
  })

  it('uses the span the AI set', () => {
    expect(spanOf({ kind: 'chart', span: 4 })).toBe(4)
    expect(spanOf({ kind: 'chart', span: 6 })).toBe(6)
    expect(spanOf({ kind: 'kpi', span: 3 })).toBe(3)
    expect(spanOf({ kind: 'kpi', span: 12 })).toBe(12)
  })

  it('tidies a span that is too narrow or too wide instead of breaking the row', () => {
    expect(spanOf({ kind: 'chart', span: 1 })).toBe(4)
    expect(spanOf({ kind: 'kpi', span: 1 })).toBe(2)
    expect(spanOf({ kind: 'chart', span: 40 })).toBe(12)
    expect(spanOf({ kind: 'kpi', span: 5.4 })).toBe(5)
  })

  it('ignores a span that is not a number', () => {
    expect(spanOf({ kind: 'chart', span: Number.NaN })).toBe(12)
    expect(spanOf({ kind: 'kpi', span: Number.POSITIVE_INFINITY })).toBe(4)
    expect(spanOf({ kind: 'chart', span: '6' as unknown as number })).toBe(12)
  })
})
