// The onboarding tour, without React: which steps an account sees, and where the explaining card goes.
import type { Section } from './types'

export type Chapter = 'layout' | 'sections' | 'data' | 'case' | 'ai' | 'build' | 'admin'
export type StepId =
  | 'sidebar' | 'header'
  | 'sec_overview' | 'sec_delivery' | 'sec_clients' | 'sec_risk' | 'sec_forecast' | 'sec_quality' | 'reports'
  | 'filters' | 'compare' | 'kpis' | 'calc'
  | 'case_setup' | 'case_read' | 'case_trend'
  | 'ask' | 'ask_howto' | 'copilot'
  | 'build' | 'build_prompt' | 'build_example'
  | 'backoffice'

/**
 * `target` is the value of the `data-tour` attribute on the element the step points at; `since` is the tour version that added it.
 * `section`: the section that has the element (the tour opens it; steps without one live on the overview).
 * `demo`: the step needs the example comparison (H2 against H1) on screen; the account's own view is put back afterwards.
 * `items`: how many bullet points (`s_<id>_i1`…) the step's card lists under its text.
 */
export type StepDef = { id: StepId; chapter: Chapter; target: string; since: number; admin?: true; section?: Section; demo?: 'compare'; items?: number }

/** The steps this account still has to see: not admin-only ones for a visitor, none it has seen, none whose element is not on screen
 * (`present` is asked about each step, so it can trust a step that lives in another section). */
export function stepsFor(defs: readonly StepDef[], o: { isAdmin: boolean; seen: number; present: (step: StepDef) => boolean }): StepDef[] {
  return defs.filter((d) => (!d.admin || o.isAdmin) && d.since > o.seen && o.present(d))
}

/** The chapters of a run, in order of appearance. */
export function chaptersOf(steps: readonly StepDef[]): Chapter[] {
  return [...new Set(steps.map((s) => s.chapter))]
}

/** Where step `index` sits among its chapter: which chapter it is of how many, and the steps (`from`..`to`) the chapter spans. */
export function chapterSpan(steps: readonly StepDef[], index: number): { chapter: Chapter; no: number; of: number; from: number; to: number } {
  const chapter = steps[index].chapter
  const from = steps.findIndex((s) => s.chapter === chapter)
  const to = steps.length - 1 - [...steps].reverse().findIndex((s) => s.chapter === chapter)
  const all = chaptersOf(steps)
  return { chapter, no: all.indexOf(chapter) + 1, of: all.length, from, to }
}

/** The first step of the chapter after the current one, or null when this is the last chapter ("skip this chapter" then ends the steps). */
export function nextChapterStart(steps: readonly StepDef[], index: number): number | null {
  const { to } = chapterSpan(steps, index)
  return to + 1 < steps.length ? to + 1 : null
}

/** Is there anything in the tour newer than `seen` for this account (it decides whether "what's new" is offered)? */
export function hasNews(defs: readonly StepDef[], isAdmin: boolean, seen: number): boolean {
  return defs.some((d) => (!d.admin || isAdmin) && d.since > seen)
}

/** The tour version an account ends up on after finishing (the newest `since`). */
export const latestVersion = (defs: readonly StepDef[]): number => Math.max(0, ...defs.map((d) => d.since))

/** Step to go to from `i`, kept inside 0..total-1. */
export const move = (i: number, dir: 1 | -1, total: number): number => Math.max(0, Math.min(i + dir, total - 1))

export type Rect = { top: number; left: number; width: number; height: number }
export type Size = { width: number; height: number }
export type Side = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'dock'
export type Placed = { top: number; left: number; side: Side }

export const DOCK_BELOW = 760 // on a phone the card sits at the bottom of the screen instead of next to its target

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, Math.max(lo, hi)))

/** Where the card goes: below its target when it fits, else above, to the right, to the left; always inside the viewport. No target = centered. */
export function placeCard(target: Rect | null, card: Size, vp: Size, gap = 14, margin = 12): Placed {
  if (vp.width <= DOCK_BELOW) return { top: vp.height - card.height - margin, left: margin, side: 'dock' }
  if (!target) return { top: (vp.height - card.height) / 2, left: (vp.width - card.width) / 2, side: 'center' }
  const right = target.left + target.width
  const bottom = target.top + target.height
  const fits = {
    bottom: bottom + gap + card.height + margin <= vp.height,
    top: target.top - gap - card.height - margin >= 0,
    right: right + gap + card.width + margin <= vp.width,
    left: target.left - gap - card.width - margin >= 0,
  }
  const side = (['bottom', 'top', 'right', 'left'] as const).find((s) => fits[s]) ?? 'bottom'
  const cx = target.left + target.width / 2 - card.width / 2
  const cy = target.top + target.height / 2 - card.height / 2
  const at = { bottom: [bottom + gap, cx], top: [target.top - gap - card.height, cx], right: [cy, right + gap], left: [cy, target.left - gap - card.width] }[side]
  const [top, left] = side === 'bottom' || side === 'top' ? at : [at[0], at[1]]
  return { top: clamp(top, margin, vp.height - card.height - margin), left: clamp(left, margin, vp.width - card.width - margin), side }
}

/** The lit-up area: the element plus some air around it. */
export const holeOf = (t: Rect, pad = 8): Rect => ({ top: t.top - pad, left: t.left - pad, width: t.width + 2 * pad, height: t.height + 2 * pad })
