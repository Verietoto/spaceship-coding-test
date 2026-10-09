// App-wide state: filters (+ which ones the AI set, undo), section, language, theme, session, saved dashboards.
import { createContext, useContext } from 'react'
import type { Lang } from '../i18n'
import type { Compare, Dimension, Filters, Meta, RangeKey, Section, View } from '../lib/types'
import type { Theme } from './useTheme'

export type Ctx = {
  view: View
  section: Section
  lang: Lang
  theme: Theme
  user: string | null
  meta: Meta | null
  canUndo: boolean
  /** Replace one dimension's list and whether it means "everything except". */
  setDim: (dim: Dimension, values: string[], exclude: boolean) => void
  /** Only this value for the dimension (used by "click a row to focus"). */
  setOnly: (dim: Dimension, value: string) => void
  /** Like setOnly, but clicking the focused value again clears the dimension. */
  focusValue: (dim: Dimension, value: string) => void
  setRange: (start: string | null, end: string | null) => void
  /** One number range (either end may be null; both null removes it). */
  setBounds: (key: RangeKey, lo: number | null, hi: number | null) => void
  /** The arrival date range. */
  setArrived: (start: string | null, end: string | null) => void
  /** Replace the whole view (a preset, a pasted link). */
  applyView: (f: Filters, compare: Compare) => void
  setCompare: (c: Compare) => void
  reset: () => void
  applyAI: (patch: Partial<Filters> & { compare?: Compare }) => void
  undo: () => void
  go: (s: Section) => void
  dashboardId: number | null
  dashVersion: number
  openDashboard: (id: number) => void
  dashboardsChanged: () => void
  setLang: (l: Lang) => void
  toggleTheme: () => void
  login: (email: string) => void
  logout: () => void
  onUnauthorized: () => void
}

export const AppContext = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}
