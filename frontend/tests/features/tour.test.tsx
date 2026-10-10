import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppContext } from '../../src/app/useApp'
import type { Ctx } from '../../src/app/useApp'
import { TourCard } from '../../src/features/tour/TourCard'
import type { CardProps } from '../../src/features/tour/TourCard'
import { tour } from '../../src/i18n/tour'
import { chaptersOf, stepsFor } from '../../src/lib/tour'
import { STEPS, TOUR_VERSION } from '../../src/lib/tourSteps'

const html = (props: Partial<CardProps>, lang: 'en' | 'id' = 'en') =>
  renderToStaticMarkup(
    <AppContext.Provider value={{ lang } as unknown as Ctx}>
      <TourCard kind="step" titleId="t" bodyId="b" title="Filters" body="Narrow the data." side="bottom" onNext={() => {}} onBack={() => {}} onSkip={() => {}} onSkipChapter={() => {}} {...props} />
    </AppContext.Provider>,
  )
const ids = (steps: readonly { id: string }[]) => steps.map((s) => s.id)
const everything = () => true

describe('the tour data', () => {
  it('has the words for every step, every bullet point and every chapter, in both languages', () => {
    for (const s of STEPS) {
      const keys = [`s_${s.id}_t`, `s_${s.id}_b`, ...Array.from({ length: s.items ?? 0 }, (_, i) => `s_${s.id}_i${i + 1}`)] as (keyof typeof tour)[]
      for (const key of keys) {
        const shortest = key.endsWith('_t') ? 3 : 15 // a title may be one word ("Klien"); the text must say something
        expect(tour[key].id.length, key).toBeGreaterThanOrEqual(shortest)
        expect(tour[key].en.length, key).toBeGreaterThanOrEqual(shortest)
      }
      expect(tour[`ch_${s.chapter}` as const].en.length).toBeGreaterThan(2)
      expect(tour[`ch_${s.chapter}` as const].id.length).toBeGreaterThan(2)
    }
  })
  it('has unique step ids, a version that matches the newest step, and one below the 99 the server accepts', () => {
    expect(new Set(ids(STEPS)).size).toBe(STEPS.length)
    expect(TOUR_VERSION).toBe(Math.max(...STEPS.map((s) => s.since)))
    expect(TOUR_VERSION).toBe(2)
    expect(TOUR_VERSION).toBeLessThanOrEqual(99)
  })
  it('keeps each chapter in one piece, so chapter numbers and "skip this chapter" make sense', () => {
    const order = STEPS.map((s) => s.chapter)
    const chapters = chaptersOf(STEPS)
    expect(chapters).toEqual(['layout', 'sections', 'data', 'case', 'ai', 'build', 'admin'])
    for (const c of chapters) {
      const first = order.indexOf(c)
      const last = order.lastIndexOf(c)
      expect(order.slice(first, last + 1).every((x) => x === c), c).toBe(true)
    }
  })
  it('keeps the admin-only step last and alone, so a visitor never sees a gap', () => {
    expect(STEPS[STEPS.length - 1].admin).toBe(true)
    expect(STEPS.filter((s) => s.admin).map((s) => s.id)).toEqual(['backoffice'])
  })
})

describe('what the tour covers', () => {
  it('introduces every section of the sidebar except the admin one', () => {
    for (const section of ['overview', 'delivery', 'clients', 'risk', 'forecast', 'quality', 'reports']) {
      const step = STEPS.find((s) => s.target === `nav-${section}`)
      expect(step, section).toBeDefined()
      expect(step?.chapter).toBe('sections')
    }
    expect(STEPS.filter((s) => s.chapter === 'sections')).toHaveLength(7)
    // the admin's Backoffice is not in the sections chapter: it is the last, admin-only step
    expect(STEPS.find((s) => s.target === 'nav-backoffice')?.chapter).toBe('admin')
  })
  it('has a worked case for comparing data that puts the example on screen in every one of its steps', () => {
    const steps = STEPS.filter((s) => s.chapter === 'case')
    expect(ids(steps)).toEqual(['case_setup', 'case_read', 'case_trend'])
    expect(steps.every((s) => s.demo === 'compare')).toBe(true)
    expect(STEPS.filter((s) => s.demo).every((s) => s.chapter === 'case')).toBe(true)
  })
  it('explains how to ask the agent and change filters with it, with example sentences', () => {
    const step = STEPS.find((s) => s.id === 'ask_howto')
    expect(step?.items).toBeGreaterThanOrEqual(3)
    expect(tour.s_ask_howto_i1.en).toContain('Show Q4 for UPS')
  })
  it('explains building a custom dashboard on the Build page itself', () => {
    const steps = STEPS.filter((s) => s.chapter === 'build')
    expect(ids(steps)).toEqual(['build', 'build_prompt', 'build_example'])
    expect(steps.filter((s) => s.section === 'build').map((s) => s.id)).toEqual(['build_prompt', 'build_example'])
  })
})

describe('who sees what', () => {
  it('shows an account that has never seen the tour everything that applies to it', () => {
    expect(stepsFor(STEPS, { isAdmin: false, seen: 0, present: everything })).toHaveLength(STEPS.length - 1)
    expect(stepsFor(STEPS, { isAdmin: true, seen: 0, present: everything })).toHaveLength(STEPS.length)
  })
  it('shows an account that finished version 1 only what version 2 added', () => {
    const news = stepsFor(STEPS, { isAdmin: true, seen: 1, present: everything })
    expect(news.every((s) => s.since === 2)).toBe(true)
    expect(ids(news)).toEqual([
      'sec_overview', 'sec_delivery', 'sec_clients', 'sec_risk', 'sec_forecast', 'sec_quality',
      'case_setup', 'case_read', 'case_trend', 'ask_howto', 'build_prompt', 'build_example',
    ])
  })
  it('shows an account that finished version 2 nothing', () => {
    expect(stepsFor(STEPS, { isAdmin: true, seen: 2, present: everything })).toEqual([])
  })
})

describe('TourCard', () => {
  const step: Partial<CardProps> = { chapter: 'Reading the data', chapterNo: 3, chapterOf: 7, dots: { total: 4, index: 2 }, index: 8, total: 22, canSkipChapter: true }
  it('is a labelled modal dialog with the chapter, its number, the title, the text and the progress', () => {
    const out = html(step)
    expect(out).toContain('role="dialog"')
    expect(out).toContain('aria-modal="true"')
    expect(out).toContain('aria-labelledby="t"')
    expect(out).toContain('aria-describedby="b"')
    expect(out).toContain('Reading the data')
    expect(out).toContain('Chapter 3 of 7')
    expect(out).toContain('Filters')
    expect(out).toContain('Narrow the data.')
    expect(out).toContain('9 of 22')
  })
  it('draws the dots of the current chapter only, with the current one marked and the earlier ones done', () => {
    const out = html(step)
    expect(out.match(/class="tour-dot"/g)).toHaveLength(4)
    expect(out.match(/aria-current="step"/g)).toHaveLength(1)
    expect(out.match(/data-done="true"/g)).toHaveLength(2)
  })
  it('lists the bullet points of a step', () => {
    const out = html({ ...step, items: ['first point', 'second point'] })
    expect(out).toContain('tour-items')
    expect(out).toContain('first point')
    expect(out).toContain('second point')
    expect(html(step)).not.toContain('tour-items')
  })
  it('offers to skip the chapter only when another chapter follows, and always to skip the tour', () => {
    expect(html(step)).toContain('>Skip this chapter<')
    expect(html({ ...step, canSkipChapter: false })).not.toContain('Skip this chapter')
    expect(html({ ...step, canSkipChapter: false })).toContain('>Skip the tour<')
  })
  it('says Next on a step and Done on the last card; the last card has no dots', () => {
    expect(html(step)).toContain('>Next<')
    const end = html({ kind: 'finish', title: 'All set', points: ['Ask this'] })
    expect(end).toContain('>Done<')
    expect(end).toContain('Ask this')
    expect(end).not.toContain('tour-dot')
  })
  it('welcomes with the three points and a Start button, or with only a Show me button for what is new', () => {
    const first = html({ kind: 'welcome', title: 'Welcome', points: ['a-point', 'b-point', 'c-point'] })
    expect(first).toContain('>Start the tour<')
    expect(first).toContain('b-point')
    expect(first).toContain('skip any chapter')
    const news = html({ kind: 'welcome', title: 'New', points: ['a-point'], isNews: true })
    expect(news).toContain('>Show me<')
    expect(news).not.toContain('a-point')
  })
  it('speaks the language of the app', () => {
    expect(html(step, 'id')).toContain('>Lanjut<')
    expect(html(step, 'id')).toContain('9 dari 22')
    expect(html(step, 'id')).toContain('Bab 3 dari 7')
  })
  it('docks to the bottom of the screen on a phone', () => {
    expect(html({ ...step, side: 'dock' })).toContain('side-dock')
  })
})
