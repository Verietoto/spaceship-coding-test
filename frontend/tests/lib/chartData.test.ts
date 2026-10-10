import { describe, expect, it } from 'vitest'
import { HEAT_MAX_COLS, SANKEY_MAX_LINKS, heat, pivot, sankey, scatterGroups, shape, slices } from '../../src/lib/chartData'
import { targetState } from '../../src/lib/kpiTarget'

const long = [
  { carrier: 'UPS', region: 'UK', n: 3 },
  { carrier: 'UPS', region: 'EU', n: 5 },
  { carrier: 'DHL', region: 'UK', n: 2 },
  { carrier: 'UPS', region: 'UK', n: 4 }, // a repeated pair adds up
]

describe('pivot', () => {
  it('turns long rows into one row per x with a column per series, in order of first appearance', () => {
    expect(pivot(long, 'carrier', 'region', 'n')).toEqual({
      rows: [{ carrier: 'UPS', UK: 7, EU: 5 }, { carrier: 'DHL', UK: 2 }],
      keys: ['UK', 'EU'],
    })
  })
  it('keeps at most 8 series and ignores values that are not numbers', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ x: 'a', s: `s${i}`, v: i }))
    expect(pivot(many, 'x', 's', 'v').keys).toHaveLength(8)
    expect(pivot([{ x: 'a', s: 'k', v: 'oops' }], 'x', 's', 'v').rows).toEqual([{ x: 'a', k: 0 }])
  })
})

describe('shape', () => {
  it('pivots when the chart names a series column and plots y as given otherwise', () => {
    expect(shape({ rows: long, x: 'carrier', y: ['n'], series: 'region' }).y).toEqual(['UK', 'EU'])
    expect(shape({ rows: long, x: 'carrier', y: ['n'], y_line: ['m'] })).toMatchObject({ rows: long, y: ['n'], line: ['m'] })
  })
})

describe('slices', () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ k: `c${i}`, v: 9 - i }))
  it('leaves a pie of up to 6 slices alone', () => {
    expect(slices(rows.slice(0, 6), 'k', 'v', 'Other')).toHaveLength(6)
  })
  it('keeps the 5 biggest and gathers the rest as one Other slice', () => {
    const got = slices(rows, 'k', 'v', 'Other')
    expect(got).toHaveLength(6)
    expect(got[5]).toEqual({ k: 'Other', v: 4 + 3 + 2 + 1 })
    expect(got.map((r) => r.k)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'Other'])
  })
})

describe('targetState', () => {
  it('judges a high-is-better value at or over its target and a low-is-better one at or under', () => {
    expect(targetState(95, 90)?.met).toBe(true)
    expect(targetState(85, 90)?.met).toBe(false)
    expect(targetState(8, 10, 'low')?.met).toBe(true)
    expect(targetState(12, 10, 'low')?.met).toBe(false)
  })
  it('caps the progress at 100% and says nothing without a value or a usable target', () => {
    expect(targetState(150, 100)?.pct).toBe(100)
    expect(targetState(null, 100)).toBeNull()
    expect(targetState(5, 0)).toBeNull()
  })
})

describe('heat', () => {
  it('lays rows and columns out in order of first appearance and shades each cell between the smallest and biggest value', () => {
    const h = heat([{ carrier: 'UPS', region: 'UK', d: 10 }, { carrier: 'UPS', region: 'EU', d: 30 }, { carrier: 'DHL', region: 'UK', d: 20 }], 'carrier', 'region', 'd')
    expect([h.rows, h.cols, h.min, h.max]).toEqual([['UPS', 'DHL'], ['UK', 'EU'], 10, 30])
    expect(h.cells.get('UPS|UK')).toEqual({ value: 10, share: 0 })
    expect(h.cells.get('DHL|UK')?.share).toBe(0.5)
    expect(h.cells.get('DHL|EU')).toBeUndefined() // a pair that has no row is an empty cell
  })
  it('adds a repeated pair, skips text values, and uses the middle shade when every value is equal', () => {
    const h = heat([{ a: 'x', b: 'y', v: 2 }, { a: 'x', b: 'y', v: 3 }, { a: 'x', b: 'z', v: 'n/a' }], 'a', 'b', 'v')
    expect(h.cells.get('x|y')).toEqual({ value: 5, share: 0.5 })
    expect(h.cols).toEqual(['y'])
  })
  it('cuts a grid wider than it can show', () => {
    const wide = Array.from({ length: 20 }, (_, i) => ({ a: 'x', b: `c${i}`, v: i }))
    expect(heat(wide, 'a', 'b', 'v').cols).toHaveLength(HEAT_MAX_COLS)
  })
})

describe('sankey', () => {
  it('makes a node for each side so a name on both sides is not a loop, and sums repeated flows', () => {
    const g = sankey([{ f: 'UK', t: 'UK', v: 5 }, { f: 'UK', t: 'EU', v: 3 }, { f: 'UK', t: 'EU', v: 2 }, { f: 'US', t: 'UK', v: 1 }], 'f', 't', 'v')
    expect(g.nodes.map((n) => n.name)).toEqual(['UK', 'US', 'UK', 'EU'])
    expect(g.links).toContainEqual({ source: 0, target: 3, value: 5 }) // UK -> EU, 3 + 2
    expect(g.links).toContainEqual({ source: 0, target: 2, value: 5 }) // UK -> UK reaches the other UK node
  })
  it('keeps only positive flows and the biggest ones', () => {
    const rows = [{ f: 'a', t: 'b', v: 0 }, { f: 'a', t: 'c', v: -4 }, ...Array.from({ length: 40 }, (_, i) => ({ f: `s${i}`, t: 'z', v: i + 1 }))]
    const g = sankey(rows, 'f', 't', 'v')
    expect(g.links).toHaveLength(SANKEY_MAX_LINKS)
    expect(Math.min(...g.links.map((l) => l.value))).toBe(11)
  })
})

describe('scatterGroups', () => {
  it('is one group without a series column and one per category with it', () => {
    const rows = [{ c: 'a', v: 1 }, { c: 'b', v: 2 }, { c: 'a', v: 3 }]
    expect(scatterGroups(rows)).toEqual([{ name: '', rows }])
    expect(scatterGroups(rows, 'c').map((g) => [g.name, g.rows.length])).toEqual([['a', 2], ['b', 1]])
  })
})
