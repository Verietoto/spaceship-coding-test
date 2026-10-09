import { describe, expect, it } from 'vitest'
import { pickedRows } from '../../src/lib/highlight'

const rows = [{ v: 5 }, { v: 9 }, { v: 1 }, { v: 9 }, { v: 7 }]
const idx = (s: Set<number>) => [...s].sort()

describe('pickedRows', () => {
  it('top n marks the highest values, wherever the bars stand', () => {
    expect(idx(pickedRows(rows, 'v', { mode: 'top', n: 3 }))).toEqual([1, 3, 4])
  })
  it('bottom n marks the lowest values', () => {
    expect(idx(pickedRows(rows, 'v', { mode: 'bottom', n: 2 }))).toEqual([0, 2])
  })
  it('equal values go in row order, so the same data always marks the same bars', () => {
    expect(idx(pickedRows(rows, 'v', { mode: 'top', n: 1 }))).toEqual([1])
  })
  it('n larger than the rows marks them all', () => {
    expect(pickedRows(rows, 'v', { mode: 'top', n: 5 }).size).toBe(5)
    expect(pickedRows(rows.slice(0, 2), 'v', { mode: 'top', n: 5 }).size).toBe(2)
  })
  it('rows without a number never count', () => {
    const mixed = [{ v: null }, { v: '9' }, { v: 2 }, { v: 4 }]
    expect(idx(pickedRows(mixed, 'v', { mode: 'top', n: 2 }))).toEqual([2, 3])
    expect(pickedRows([], 'v', { mode: 'top', n: 3 }).size).toBe(0)
    expect(pickedRows(rows, 'missing', { mode: 'top', n: 3 }).size).toBe(0)
  })
})
