import { describe, expect, it } from 'vitest'
import { extraCount, fromSearch, isDefault, slug, toParams, toSearch, withRange } from '../../src/lib/filterQuery'
import { DEFAULT_FILTERS } from '../../src/lib/types'
import type { Filters } from '../../src/lib/types'

const full: Filters = {
  ...DEFAULT_FILTERS,
  start: '2025-10-01',
  end: '2025-12-31',
  carrier: ['UPS'],
  category: ['CRAYON', 'PAPER'],
  status: ['delayed'],
  promo: ['0'],
  destination: ['Leeds, UK'],
  exclude: ['promo'],
  ranges: { value: [50, null], lead: [null, 7] },
  arrived_start: '2025-02-01',
}

describe('the URL and the API query', () => {
  it('writes only what differs from "everything"', () => {
    expect(toParams(DEFAULT_FILTERS)).toEqual({})
    expect(toParams(full)).toEqual({
      start: '2025-10-01', end: '2025-12-31', arrived_start: '2025-02-01',
      carrier: ['UPS'], category: ['CRAYON', 'PAPER'], status: ['delayed'], promo: ['0'], destination: ['Leeds, UK'],
      exclude: ['promo'], value_min: '50', lead_max: '7',
    })
  })

  it('reads back what it wrote, for every kind of filter', () => {
    expect(fromSearch(toSearch(full, 'prev')).f).toEqual(full)
    expect(fromSearch(toSearch(full, 'base'))).toEqual({ f: full, compare: 'base', cmpRange: null })
  })

  it('ignores a bound that is not a number, an exclude with no values, and a bad date', () => {
    const { f } = fromSearch('?value_min=abc&lead_max=&age_min=3&exclude=status&arrived_start=soon&status=')
    expect(f.ranges).toEqual({ age: [3, null] })
    expect(f.exclude).toEqual([])
    expect(f.arrived_start).toBeNull()
  })

  it('keeps zero as a real bound', () => {
    expect(fromSearch('?age_min=0').f.ranges).toEqual({ age: [0, null] })
    expect(toParams({ ...DEFAULT_FILTERS, ranges: { age: [0, null] } })).toEqual({ age_min: '0' })
  })

  it('understands an old link with only the first filters', () => {
    expect(fromSearch('?carrier=UPS&start=2025-01-01').f).toEqual({ ...DEFAULT_FILTERS, carrier: ['UPS'], start: '2025-01-01' })
  })
})

describe('isDefault and extraCount', () => {
  it('sees a range or an arrival date as a filter', () => {
    expect(isDefault(DEFAULT_FILTERS)).toBe(true)
    expect(isDefault({ ...DEFAULT_FILTERS, ranges: { value: [1, 2] } })).toBe(false)
    expect(isDefault({ ...DEFAULT_FILTERS, arrived_end: '2025-05-01' })).toBe(false)
    expect(isDefault({ ...DEFAULT_FILTERS, sku: ['CRAYON-0017'] })).toBe(false)
  })

  it('counts the filters that live in the "more filters" panel, not the ones always on the bar', () => {
    expect(extraCount(DEFAULT_FILTERS)).toBe(0)
    expect(extraCount({ ...DEFAULT_FILTERS, carrier: ['UPS'], region: ['EU'], start: '2025-01-01' })).toBe(0)
    expect(extraCount(full)).toBe(1 + 1 + 1 + 1 + 2 + 1) // category, status, promo, destination, two ranges, arrival dates
  })
})

describe('withRange', () => {
  it('sets, changes and removes one range without touching the others', () => {
    const a = withRange(DEFAULT_FILTERS, 'value', 10, 50)
    expect(a.ranges).toEqual({ value: [10, 50] })
    const b = withRange(a, 'lead', null, 7)
    expect(b.ranges).toEqual({ value: [10, 50], lead: [null, 7] })
    expect(withRange(b, 'value', null, null).ranges).toEqual({ lead: [null, 7] })
    expect(a.ranges).toEqual({ value: [10, 50] }) // the original is unchanged
  })
})

describe('slug', () => {
  it('names the new filters for a file', () => {
    expect(slug({ ...DEFAULT_FILTERS, category: ['PAPER'], status: ['delayed'], exclude: ['status'], ranges: { value: [10, 50] } })).toBe('PAPER_not_delayed_value10-50')
    expect(slug({ ...DEFAULT_FILTERS, ranges: { lead: [null, 7] }, arrived_start: '2025-03-01' })).toBe('lead-7_arrived2025-03-01-')
    expect(slug(DEFAULT_FILTERS)).toBe('all')
  })
})

describe('comparison with another period in the URL', () => {
  const cmpRange = { start: '2025-01-01', end: '2025-06-30' }
  it('round-trips the other period', () => {
    const search = toSearch(full, 'custom', cmpRange)
    expect(search).toContain('compare=custom')
    expect(fromSearch(search)).toMatchObject({ compare: 'custom', cmpRange })
  })
  it('keeps the period out of the URL for the other modes and drops a broken one', () => {
    expect(toSearch(full, 'base', cmpRange)).not.toContain('cmp_start')
    expect(fromSearch('?compare=custom&cmp_start=2025-07-01&cmp_end=2025-01-01').cmpRange).toBeNull()
    expect(fromSearch('?compare=custom&cmp_start=x').cmpRange).toBeNull()
    expect(fromSearch('?compare=prev&cmp_start=2025-01-01&cmp_end=2025-06-30').cmpRange).toBeNull()
  })
})
