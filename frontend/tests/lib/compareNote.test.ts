import { describe, expect, it } from 'vitest'
import { compareNote } from '../../src/lib/compareNote'
import { latestRange } from '../../src/lib/period'

const range = { start: '2025-01-01', end: '2025-03-31' }
const stats = {}

describe('compareNote', () => {
  it('says off when comparison is switched off', () => {
    expect(compareNote('none', { mode: 'none', stats: null }, true)).toBe('off')
  })
  it('names the two periods when there is an earlier one', () => {
    expect(compareNote('prev', { mode: 'prev', range, stats }, true)).toBe('range')
  })
  it('tells when it fell back from the previous period to all data', () => {
    expect(compareNote('prev', { mode: 'base', stats }, true)).toBe('fallback_all')
    expect(compareNote('base', { mode: 'base', stats }, false)).toBe('all')
  })
  it('asks for a filter when there is nothing to compare with all data', () => {
    expect(compareNote('base', { mode: 'base', stats: null }, false)).toBe('pick_dim')
  })
  it('separates "no earlier data" from "no period picked"', () => {
    expect(compareNote('prev', { mode: 'prev', range: null, stats: null }, true)).toBe('no_earlier')
    expect(compareNote('prev', { mode: 'prev', range: null, stats: null }, false)).toBe('pick_period')
  })
})

describe('compareNote with another period', () => {
  it('names both periods once one is chosen, whatever the main period is', () => {
    expect(compareNote('custom', { mode: 'custom', range, stats }, true)).toBe('custom')
    expect(compareNote('custom', { mode: 'custom', range, stats }, false)).toBe('custom')
  })
  it('asks for the period to compare with until one is chosen', () => {
    expect(compareNote('custom', { mode: 'custom', range: null, stats: null }, true)).toBe('pick_compare')
  })
})

describe('latestRange', () => {
  it('is the calendar month or quarter holding the newest data', () => {
    expect(latestRange('month', '2025-12-30')).toEqual(['2025-12-01', '2025-12-31'])
    expect(latestRange('quarter', '2025-11-15')).toEqual(['2025-10-01', '2025-12-31'])
    expect(latestRange('quarter', '2025-02-28')).toEqual(['2025-01-01', '2025-03-31'])
  })
})
