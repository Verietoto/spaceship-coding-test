// Runs the tour: decides when it starts (once per account, kept on the server), draws the spotlight and the card over the page,
// opens the section a step lives in, shows the worked example (H2 against H1) and puts the account's own view back afterwards,
// and offers "restart" and "what's new" to the help button. Mounted only for a logged-in user.
import { createContext, useContext, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useApi } from '../../app/useApi'
import { useApp } from '../../app/useApp'
import { useMessages } from '../../i18n'
import { tour as tourMsg } from '../../i18n/tour'
import { api } from '../../lib/api'
import { presetRange } from '../../lib/period'
import { prefillAsk } from '../../lib/prefill'
import { DOCK_BELOW, chapterSpan, hasNews, holeOf, move, nextChapterStart, placeCard, stepsFor } from '../../lib/tour'
import type { Rect, Size, StepDef } from '../../lib/tour'
import { STEPS, TOUR_VERSION } from '../../lib/tourSteps'
import { DEFAULT_FILTERS } from '../../lib/types'
import type { Compare, DateRange, Filters, Section } from '../../lib/types'
import { TourCard } from './TourCard'

type Me = { email: string; role: 'admin' | 'visitor'; tour_version: number }
type Phase = 'welcome' | 'step' | 'finish'
/** auto: the first time (remembered when it ends); news: what an older account has not seen (remembered); replay: from the help button (not remembered). */
type Run = { kind: 'auto' | 'news' | 'replay'; steps: StepDef[]; phase: Phase; index: number }
/** The account's own filters and comparison, kept while the worked example is on screen. */
type Snapshot = { f: Filters; compare: Compare; cmpRange: DateRange | null }

type Controls = { restart: () => void; showNews: () => void; hasNews: boolean }
const TourContext = createContext<Controls | null>(null)
/** The help button's view of the tour; null outside a logged-in app. */
export const useTourControls = (): Controls | null => useContext(TourContext)

const RESTORE_KEY = 'tour:restore' // survives a reload in the middle of the example, so the account's own view still comes back
const isPresent = (target: string): boolean => document.querySelector(`[data-tour="${target}"]`) !== null
const elOf = (target: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
const FOCUSABLE = 'button:not([disabled])'

function keepView(s: Snapshot): void {
  try {
    sessionStorage.setItem(RESTORE_KEY, JSON.stringify(s))
  } catch {
    /* storage blocked: the view is still restored when the tour ends normally */
  }
}
function forgetView(): void {
  try {
    sessionStorage.removeItem(RESTORE_KEY)
  } catch {
    /* nothing to forget */
  }
}
function savedView(): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(RESTORE_KEY)
    return raw ? (JSON.parse(raw) as Snapshot) : null
  } catch {
    return null
  }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { section, go, view, meta, applyView, setCompare } = useApp()
  const { data: me } = useApi<Me>('me')
  const [run, setRun] = useState<Run | null>(null)
  const started = useRef(false) // the automatic start happens once per page load
  const origin = useRef<Section>('overview') // where the account was when the tour began; it goes back there
  const saved = useRef<Snapshot | null>(null) // the account's own view while the example is on screen
  const isAdmin = me?.role === 'admin'
  const seen = me?.tour_version ?? 0

  const startRun = (kind: Run['kind']) => {
    origin.current = section
    const compute = () => {
      // a step in another section (the Build page) is trusted: it is checked when the tour gets there
      const steps = stepsFor(STEPS, { isAdmin, seen: kind === 'replay' ? 0 : seen, present: (d) => d.section !== undefined || isPresent(d.target) })
      if (steps.length) setRun({ kind, steps, phase: 'welcome', index: 0 })
    }
    if (section !== 'overview') {
      go('overview') // the tour is anchored on the overview; wait for it to appear
      window.setTimeout(compute, 700)
      return
    }
    compute()
  }
  const autoStart = useEffectEvent((kind: Run['kind']) => startRun(kind)) // only for the effect below; the help button calls startRun itself

  // Once per account: when the overview is on screen and the server says this account has not finished this version.
  useEffect(() => {
    if (!me || started.current || me.tour_version >= TOUR_VERSION || section !== 'overview') return
    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      if (isPresent('kpis') || tries > 16) {
        window.clearInterval(timer)
        started.current = true
        autoStart(me.tour_version === 0 ? 'auto' : 'news')
      }
    }, 300)
    return () => window.clearInterval(timer)
  }, [me, section])

  // The worked example: H2 of the latest year against H1, on a clean set of filters.
  const showExample = useEffectEvent(() => {
    if (saved.current || !meta?.years.length) return // already on screen, or the data does not say which year to use
    const year = Math.max(...meta.years)
    const [h2Start, h2End] = presetRange('H2', year)
    const [h1Start, h1End] = presetRange('H1', year)
    saved.current = { f: view.f, compare: view.compare, cmpRange: view.cmpRange }
    keepView(saved.current)
    applyView({ ...DEFAULT_FILTERS, start: h2Start, end: h2End }, 'custom')
    setCompare('custom', { start: h1Start, end: h1End })
  })
  const putViewBack = useEffectEvent(() => {
    const s = saved.current ?? savedView() // the second one: the page was reloaded while the example was on screen
    if (!s) return
    saved.current = null
    forgetView()
    applyView(s.f, s.compare)
    setCompare(s.compare, s.cmpRange)
  })
  const wantsExample = run?.phase === 'step' && run.steps[run.index]?.demo === 'compare'
  useEffect(() => {
    if (wantsExample) showExample()
    else putViewBack()
  }, [wantsExample])

  const close = (persist: boolean) => {
    setRun(null)
    go(origin.current)
    // The server remembers it, so it follows the account to other browsers. If this fails the tour still stays closed for this visit.
    if (persist) void api('me/tour', {}, { version: TOUR_VERSION }).catch(() => undefined)
  }

  const controls: Controls = { restart: () => startRun('replay'), showNews: () => startRun('news'), hasNews: hasNews(STEPS, isAdmin, seen) }

  const persist = run !== null && run.kind !== 'replay'
  const next = () =>
    setRun((r) => {
      if (!r) return r
      if (r.phase === 'welcome') return { ...r, phase: 'step', index: 0 }
      if (r.phase === 'step') return r.index < r.steps.length - 1 ? { ...r, index: r.index + 1 } : { ...r, phase: 'finish' }
      return r
    })
  const back = () =>
    setRun((r) => {
      if (!r) return r
      if (r.phase === 'step') return r.index === 0 ? { ...r, phase: 'welcome' } : { ...r, index: move(r.index, -1, r.steps.length) }
      if (r.phase === 'finish') return { ...r, phase: 'step', index: r.steps.length - 1 }
      return r
    })
  const skipChapter = () =>
    setRun((r) => {
      if (!r || r.phase !== 'step') return r
      const j = nextChapterStart(r.steps, r.index)
      return j === null ? { ...r, phase: 'finish' } : { ...r, index: j }
    })
  const finish = () => close(persist)
  const advance = () => (run?.phase === 'finish' ? finish() : next())
  const tryAsk = (q: string) => {
    close(persist)
    let tries = 0 // the command bar comes back with the section; fill it as soon as it is there
    const timer = window.setInterval(() => {
      tries += 1
      if (isPresent('ask') || tries > 20) {
        window.clearInterval(timer)
        prefillAsk(q)
      }
    }, 100)
  }

  return (
    <TourContext.Provider value={controls}>
      {children}
      {run && createPortal(<Overlay run={run} onNext={advance} onBack={back} onSkip={finish} onSkipChapter={skipChapter} onTry={tryAsk} />, document.body)}
    </TourContext.Provider>
  )
}

type OverlayProps = { run: Run; onNext: () => void; onBack: () => void; onSkip: () => void; onSkipChapter: () => void; onTry: (q: string) => void }

function Overlay({ run, onNext, onBack, onSkip, onSkipChapter, onTry }: OverlayProps) {
  const t = useMessages(tourMsg)
  const id = useId()
  const { section, go } = useApp()
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null) // the card's own element (a callback ref, so a new card is noticed)
  const [size, setSize] = useState<Size | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [found, setFound] = useState<{ target: string; el: HTMLElement } | null>(null)
  const step = run.phase === 'step' ? run.steps[run.index] : null
  const isNews = run.kind === 'news'
  const docked = window.innerWidth <= DOCK_BELOW

  // Callbacks the effects below call without re-running every time the parent re-renders.
  const goNext = useEffectEvent(onNext)
  const goBack = useEffectEvent(onBack)
  const stop = useEffectEvent(onSkip)

  // The tour lives on the overview; a step can ask for another section (the Build page).
  const wantSection: Section = step?.section ?? 'overview'
  const openSection = useEffectEvent((want: Section) => {
    if (section !== want) go(want)
  })
  useEffect(() => {
    openSection(wantSection)
  }, [wantSection])

  // Wait for the element of the step to be on screen (its section may still be loading); a step whose element never shows up is skipped.
  useEffect(() => {
    if (!step) return
    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      const el = elOf(step.target)
      if (el) {
        window.clearInterval(timer)
        setFound({ target: step.target, el })
      } else if (tries > 25) {
        window.clearInterval(timer)
        goNext()
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [step])
  const targetEl = step && found?.target === step.target && found.el.isConnected ? found.el : null

  // Where the element is, now and whenever the page moves under it.
  useLayoutEffect(() => {
    if (!targetEl) return
    targetEl.scrollIntoView({ block: 'center', inline: 'nearest' })
    const measure = () => {
      const r = targetEl.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(targetEl)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [targetEl])

  // How big the card is (it changes with its text), so it can be placed next to the element.
  useLayoutEffect(() => {
    if (!cardEl) return
    const measure = () => setSize({ width: cardEl.offsetWidth, height: cardEl.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(cardEl)
    return () => ro.disconnect()
  }, [cardEl])
  // The card goes next to the element, inside the screen (centered for the welcome and the last card); hidden until it is measured
  // and, for a step, until its element is on screen.
  const spot = targetEl ? rect : null
  const isReady = size !== null && (!step || targetEl !== null)
  const placed = size ? placeCard(spot, size, { width: window.innerWidth, height: window.innerHeight }) : null

  // Keyboard: arrows move, Escape closes, Tab stays inside the card.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') return stop()
    if (e.key === 'ArrowRight') return goNext()
    if (e.key === 'ArrowLeft') return goBack()
    if (e.key !== 'Tab') return
    const items = Array.from(cardEl?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (!items.length) return
    const [first, last] = [items[0], items[items.length - 1]]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  })
  useEffect(() => {
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  // Focus goes to the card, and back to where it was when the tour ends.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    return () => {
      if (before && document.contains(before)) before.focus()
    }
  }, [])
  useEffect(() => {
    cardEl?.querySelector<HTMLElement>('[data-tour-primary]')?.focus({ preventScroll: true })
  }, [cardEl])

  const titleId = `${id}-title`
  const bodyId = `${id}-body`
  const total = run.steps.length
  const common = { titleId, bodyId, ref: setCardEl, side: placed?.side ?? (docked ? 'dock' : 'center'), onNext, onBack, onSkip, isNews } as const
  const style = { top: placed?.top ?? 0, left: placed?.left ?? 0, visibility: isReady ? ('visible' as const) : ('hidden' as const) }
  let card = null
  if (run.phase === 'welcome') {
    card = (
      <TourCard key="welcome" {...common} kind="welcome" title={t(isNews ? 'news_title' : 'welcome_title')} body={t(isNews ? 'news_lead' : 'welcome_lead')} points={[t('welcome_p1'), t('welcome_p2'), t('welcome_p3')]} style={style} />
    )
  } else if (run.phase === 'finish') {
    card = (
      <TourCard key="finish" {...common} kind="finish" title={t('finish_title')} body={t(isNews ? 'finish_body_news' : 'finish_body')} points={isNews ? [] : [t('finish_q1'), t('finish_q2')]} hint={t('finish_hint')} style={style} onTry={onTry} />
    )
  } else if (step) {
    const span = chapterSpan(run.steps, run.index)
    const items = Array.from({ length: step.items ?? 0 }, (_, i) => t(`s_${step.id}_i${i + 1}` as keyof typeof tourMsg))
    card = (
      <TourCard
        key="step"
        {...common}
        kind="step"
        chapter={t(`ch_${step.chapter}`)}
        chapterNo={span.no}
        chapterOf={span.of}
        dots={{ total: span.to - span.from + 1, index: run.index - span.from }}
        canSkipChapter={nextChapterStart(run.steps, run.index) !== null}
        onSkipChapter={onSkipChapter}
        title={t(`s_${step.id}_t`)}
        body={t(`s_${step.id}_b`)}
        items={items}
        index={run.index}
        total={total}
        style={style}
      />
    )
  }
  const hole = spot ? holeOf(spot) : null
  return (
    <div className="tour-root">
      <div className="tour-shield" aria-hidden="true" />
      {hole ? <div className="tour-hole" aria-hidden="true" style={hole} /> : <div className="tour-dim" aria-hidden="true" />}
      <div className="sr-only" aria-live="polite">
        {step ? t('announce', { n: run.index + 1, total, title: t(`s_${step.id}_t`) }) : ''}
      </div>
      {card}
    </div>
  )
}
