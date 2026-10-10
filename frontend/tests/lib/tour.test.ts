import { describe, expect, it } from 'vitest'
import { DOCK_BELOW, chapterSpan, chaptersOf, hasNews, holeOf, latestVersion, move, nextChapterStart, placeCard, stepsFor } from '../../src/lib/tour'
import type { Rect, StepDef } from '../../src/lib/tour'

const DEFS: StepDef[] = [
  { id: 'sidebar', chapter: 'layout', target: 'sidebar', since: 1 },
  { id: 'kpis', chapter: 'data', target: 'kpis', since: 1 },
  { id: 'build', chapter: 'ai', target: 'build', since: 2 },
  { id: 'backoffice', chapter: 'more', target: 'nav-backoffice', since: 1, admin: true },
]
const all = () => true // every element is on screen

describe('stepsFor', () => {
  it('gives a new account the whole tour that applies to it', () => {
    expect(stepsFor(DEFS, { isAdmin: false, seen: 0, present: all }).map((s) => s.id)).toEqual(['sidebar', 'kpis', 'build'])
    expect(stepsFor(DEFS, { isAdmin: true, seen: 0, present: all }).map((s) => s.id)).toEqual(['sidebar', 'kpis', 'build', 'backoffice'])
  })
  it('gives an account that saw version 1 only what came after it', () => {
    expect(stepsFor(DEFS, { isAdmin: true, seen: 1, present: all }).map((s) => s.id)).toEqual(['build'])
    expect(stepsFor(DEFS, { isAdmin: true, seen: 2, present: all })).toEqual([])
  })
  it('leaves out steps whose element is not on screen', () => {
    const present = (d: StepDef) => d.target !== 'kpis'
    expect(stepsFor(DEFS, { isAdmin: false, seen: 0, present }).map((s) => s.id)).toEqual(['sidebar', 'build'])
  })
})

describe('stepsFor and steps in another section', () => {
  it('asks about each step, so the caller can trust a step that lives in a section that is not open yet', () => {
    const defs: StepDef[] = [
      { id: 'kpis', chapter: 'data', target: 'kpis', since: 1 },
      { id: 'build_prompt', chapter: 'build', target: 'build-prompt', since: 1, section: 'build' },
    ]
    const onlyOverview = (d: StepDef) => d.section !== undefined || d.target === 'kpis'
    expect(stepsFor(defs, { isAdmin: false, seen: 0, present: onlyOverview }).map((s) => s.id)).toEqual(['kpis', 'build_prompt'])
    expect(stepsFor(defs, { isAdmin: false, seen: 0, present: (d) => d.target === 'kpis' }).map((s) => s.id)).toEqual(['kpis'])
  })
})

describe('chapters', () => {
  const run: StepDef[] = [
    { id: 'sidebar', chapter: 'layout', target: 'a', since: 1 },
    { id: 'header', chapter: 'layout', target: 'b', since: 1 },
    { id: 'filters', chapter: 'data', target: 'c', since: 1 },
    { id: 'kpis', chapter: 'data', target: 'd', since: 1 },
    { id: 'calc', chapter: 'data', target: 'e', since: 1 },
    { id: 'ask', chapter: 'ai', target: 'f', since: 1 },
  ]
  it('lists the chapters of a run in order', () => {
    expect(chaptersOf(run)).toEqual(['layout', 'data', 'ai'])
  })
  it('says which chapter a step is in, of how many, and which steps it spans', () => {
    expect(chapterSpan(run, 0)).toEqual({ chapter: 'layout', no: 1, of: 3, from: 0, to: 1 })
    expect(chapterSpan(run, 3)).toEqual({ chapter: 'data', no: 2, of: 3, from: 2, to: 4 })
    expect(chapterSpan(run, 5)).toEqual({ chapter: 'ai', no: 3, of: 3, from: 5, to: 5 })
  })
  it('jumps to the first step of the next chapter, and to nothing after the last chapter', () => {
    expect(nextChapterStart(run, 0)).toBe(2)
    expect(nextChapterStart(run, 1)).toBe(2)
    expect(nextChapterStart(run, 3)).toBe(5)
    expect(nextChapterStart(run, 5)).toBeNull()
  })
  it('handles a run of a single chapter (what is new)', () => {
    expect(chapterSpan(run.slice(2, 5), 1)).toEqual({ chapter: 'data', no: 1, of: 1, from: 0, to: 2 })
    expect(nextChapterStart(run.slice(2, 5), 0)).toBeNull()
  })
})

describe('versions', () => {
  it('knows the newest version and whether there is news for an account', () => {
    expect(latestVersion(DEFS)).toBe(2)
    expect(latestVersion([])).toBe(0)
    expect(hasNews(DEFS, false, 1)).toBe(true)
    expect(hasNews(DEFS, false, 2)).toBe(false)
    expect(hasNews([{ id: 'backoffice', chapter: 'more', target: 'x', since: 3, admin: true }], false, 0)).toBe(false) // admin-only news is not news for a visitor
  })
})

describe('move', () => {
  it('stays inside the steps', () => {
    expect(move(0, -1, 5)).toBe(0)
    expect(move(4, 1, 5)).toBe(4)
    expect(move(2, 1, 5)).toBe(3)
    expect(move(2, -1, 5)).toBe(1)
    expect(move(0, 1, 0)).toBe(0)
  })
})

const VP = { width: 1280, height: 800 }
const CARD = { width: 380, height: 220 }
const inside = (p: { top: number; left: number }) => p.top >= 12 && p.left >= 12 && p.top + CARD.height <= VP.height - 12 && p.left + CARD.width <= VP.width - 12

describe('placeCard', () => {
  it('goes below the target when there is room, centered on it', () => {
    const t: Rect = { top: 100, left: 600, width: 200, height: 60 }
    const p = placeCard(t, CARD, VP)
    expect(p.side).toBe('bottom')
    expect(p.top).toBe(100 + 60 + 14)
    expect(p.left).toBe(600 + 100 - 190)
  })
  it('goes above a target at the bottom of the screen', () => {
    expect(placeCard({ top: 700, left: 500, width: 200, height: 60 }, CARD, VP).side).toBe('top')
  })
  it('goes beside a target that is as tall as the screen (the sidebar)', () => {
    const p = placeCard({ top: 0, left: 0, width: 240, height: 800 }, CARD, VP)
    expect(p.side).toBe('right')
    expect(p.left).toBe(240 + 14)
  })
  it('never leaves the viewport, whichever corner the target is in', () => {
    const corners: Rect[] = [
      { top: 0, left: 0, width: 80, height: 40 },
      { top: 0, left: 1200, width: 80, height: 40 },
      { top: 760, left: 0, width: 80, height: 40 },
      { top: 760, left: 1200, width: 80, height: 40 },
      { top: 300, left: 1180, width: 100, height: 100 },
    ]
    for (const c of corners) expect(inside(placeCard(c, CARD, VP))).toBe(true)
  })
  it('centers a card that has no target (welcome and finish)', () => {
    expect(placeCard(null, CARD, VP)).toEqual({ top: 290, left: 450, side: 'center' })
  })
  it('docks to the bottom of a phone screen, whatever the target', () => {
    const phone = { width: DOCK_BELOW, height: 640 }
    expect(placeCard({ top: 10, left: 10, width: 50, height: 50 }, CARD, phone)).toEqual({ top: 640 - 220 - 12, left: 12, side: 'dock' })
    expect(placeCard(null, CARD, phone).side).toBe('dock')
  })
})

describe('holeOf', () => {
  it('adds air around the element', () => {
    expect(holeOf({ top: 100, left: 50, width: 200, height: 40 }, 8)).toEqual({ top: 92, left: 42, width: 216, height: 56 })
  })
})
