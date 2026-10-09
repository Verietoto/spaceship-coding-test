// Provides the app-wide state (see useApp.ts for its shape): filters (+ which ones the AI set, undo), section, language, theme, session, saved dashboards.
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Lang } from '../i18n'
import { Unauthorized, api } from '../lib/api'
import { store, stored } from '../lib/storage'
import { fromSearch, isOnly, toSearch, withValues, withRange } from '../lib/filterQuery'
import { DEFAULT_FILTERS, DIMENSIONS, RANGE_KEYS } from '../lib/types'
import type { AIKey, Filters, Meta, Section, View } from '../lib/types'
import { AppContext } from './useApp'
import type { Ctx } from './useApp'
import { useTheme } from './useTheme'

const DEFAULT_VIEW: View = { f: DEFAULT_FILTERS, compare: 'prev', ai: {} }

function initialView(): View {
  const { f, compare } = fromSearch(window.location.search)
  return { f, compare, ai: {} }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>(initialView)
  const [history, setHistory] = useState<View[]>([])
  const [section, setSection] = useState<Section>('overview')
  const [lang, setLangState] = useState<Lang>(() => stored<Lang>('lang', 'id'))
  const { theme, toggleTheme } = useTheme()
  const [user, setUser] = useState<string | null>(() => stored<string>('user', '') || null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [dashboardId, setDashboardId] = useState<number | null>(null)
  const [dashVersion, setDashVersion] = useState(0)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // The view lives in the URL, so a link can be shared or bookmarked.
  useEffect(() => {
    const next = `${window.location.pathname}${toSearch(view.f, view.compare)}`
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', next)
  }, [view.f, view.compare])

  const onUnauthorized = useCallback(() => {
    setUser(null)
    store('user', '')
  }, [])

  useEffect(() => {
    if (!user) return
    api<Meta>('meta').then(setMeta, (e: unknown) => e instanceof Unauthorized && onUnauthorized())
  }, [user, onUnauthorized])

  const ctx: Ctx = {
    view,
    section,
    lang,
    theme,
    user,
    meta,
    canUndo: history.length > 0,
    setDim: (dim, values, exclude) =>
      setView((v) => ({ ...v, f: withValues(v.f, dim, values, exclude), ai: { ...v.ai, [dim]: false } })),
    setOnly: (dim, value) => setView((v) => ({ ...v, f: withValues(v.f, dim, [value], false), ai: { ...v.ai, [dim]: false } })),
    focusValue: (dim, value) =>
      setView((v) => ({ ...v, f: withValues(v.f, dim, isOnly(v.f, dim, value) ? [] : [value], false), ai: { ...v.ai, [dim]: false } })),
    setRange: (start, end) => setView((v) => ({ ...v, f: { ...v.f, start, end }, ai: { ...v.ai, period: false } })),
    setBounds: (key, lo, hi) => setView((v) => ({ ...v, f: withRange(v.f, key, lo, hi), ai: { ...v.ai, [key]: false } })),
    setArrived: (start, end) => setView((v) => ({ ...v, f: { ...v.f, arrived_start: start, arrived_end: end }, ai: { ...v.ai, arrived: false } })),
    applyView: (f, compare) => setView({ f, compare, ai: {} }),
    setCompare: (compare) => setView((v) => ({ ...v, compare, ai: { ...v.ai, compare: false } })),
    reset: () => setView(DEFAULT_VIEW),
    applyAI: (patch) => {
      setHistory((h) => [...h, view])
      setView((v) => {
        const { compare, ...fp } = patch
        const f: Filters = { ...v.f, ...fp }
        const ai: View['ai'] = { ...v.ai }
        const mark = (k: AIKey, on: boolean) => (ai[k] = on)
        if ('start' in fp || 'end' in fp) mark('period', f.start !== null || f.end !== null)
        for (const d of DIMENSIONS) if (d in fp || fp.exclude) mark(d, f[d].length > 0 && (d in fp || (fp.exclude?.includes(d) ?? false)))
        if ('ranges' in fp) for (const k of RANGE_KEYS) mark(k, k in f.ranges && k in (fp.ranges ?? {}))
        if ('arrived_start' in fp || 'arrived_end' in fp) mark('arrived', f.arrived_start !== null || f.arrived_end !== null)
        if (compare) mark('compare', compare !== 'prev')
        return { f, compare: compare ?? v.compare, ai }
      })
    },
    undo: () => {
      const prev = history.at(-1)
      if (!prev) return
      setView(prev)
      setHistory((h) => h.slice(0, -1))
    },
    go: setSection,
    dashboardId,
    dashVersion,
    openDashboard: (id) => {
      setDashboardId(id)
      setSection('saved')
    },
    dashboardsChanged: () => setDashVersion((v) => v + 1),
    setLang: (l) => {
      setLangState(l)
      store('lang', l)
    },
    toggleTheme,
    login: (email) => {
      setUser(email)
      setDashVersion((v) => v + 1)
      store('user', email)
    },
    logout: () => {
      void api('logout', {}, {}).catch(() => undefined)
      setView(DEFAULT_VIEW)
      setHistory([])
      setSection('overview')
      onUnauthorized()
    },
    onUnauthorized,
  }

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>
}
