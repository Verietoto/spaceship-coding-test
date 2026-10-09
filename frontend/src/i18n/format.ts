// Numbers, money, percentages, days, months and periods in the active language (Intl, null-safe: "—").
import { useApp } from '../app/useApp'
import { common } from './common'
import { matchPreset } from '../lib/period'
import { LOCALE, translate } from '.'
import type { Lang } from '.'

const DASH = '—'
type N = number | null | undefined

function make(lang: Lang) {
  const loc = LOCALE[lang]
  const t = translate(common, lang)
  const fixed = (d: number) => new Intl.NumberFormat(loc, { minimumFractionDigits: d, maximumFractionDigits: d })
  const plain = new Intl.NumberFormat(loc)
  const usd0 = new Intl.NumberFormat(loc, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 })
  const usdK = new Intl.NumberFormat(loc, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
  const usd2 = new Intl.NumberFormat(loc, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const pct = new Intl.NumberFormat(loc, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const pct0 = new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: 0 })
  const month = new Intl.DateTimeFormat(loc, { month: 'short', timeZone: 'UTC' })
  const day = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const f0 = fixed(0)
  const f1 = fixed(1)
  const f2 = fixed(2)

  const fmt = {
    int: (v: N) => (v == null ? DASH : plain.format(v)),
    num0: (v: N) => (v == null ? DASH : f0.format(v)),
    num1: (v: N) => (v == null ? DASH : f1.format(v)),
    num2: (v: N) => (v == null ? DASH : f2.format(v)),
    /** $3.1K / US$3,1 rb above 1000, whole dollars below. */
    usd: (v: N) => (v == null ? DASH : (Math.abs(v) >= 1000 ? usdK : usd0).format(v)),
    usd2: (v: N) => (v == null ? DASH : usd2.format(v)),
    /** v is already a percentage (13.75 -> 13.8%). */
    pct1: (v: N) => (v == null ? DASH : pct.format(v / 100)),
    pct0: (v: N) => (v == null ? DASH : pct0.format(v / 100)),
    days: (v: N) => (v == null ? DASH : t('days_value', { v: f1.format(v) })),
    month: (m: number) => month.format(Date.UTC(2025, m - 1, 1)),
    /** "Jan ’25" for "2025-01". */
    monthYear: (ym: string) => `${month.format(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1))} ’${ym.slice(2, 4)}`,
    /** "1 Okt 2025" for an ISO date. */
    date: (iso: string) => day.format(Date.parse(`${iso}T00:00:00Z`)),
    /** A preset by name ("Setahun 2025", "Q4 2025", "Mar 2025"), otherwise "1 Okt 2025 – 31 Des 2025"; "All data" when open. */
    range: (start: string | null, end: string | null): string => {
      if (!start && !end) return t('period_all')
      const m = matchPreset(start, end)
      if (m) {
        const name = m.code === 'FY' ? null : m.code[0] === 'M' ? fmt.month(Number(m.code.slice(1))) : m.code
        return name ? t('period_in_year', { p: name, y: m.year }) : t('period_fy', { y: m.year })
      }
      return t('range_to', { a: start ? fmt.date(start) : '…', b: end ? fmt.date(end) : '…' })
    },
    /** Option label for a preset in the picker (the year is the group). */
    presetOption: (code: string) => (code === 'FY' ? t('period_fy_short') : code[0] === 'M' ? fmt.month(Number(code.slice(1))) : code),
    /** Any cell value from a query result. */
    value: (v: unknown) => (typeof v === 'number' ? (Number.isInteger(v) ? plain.format(v) : f2.format(v)) : String(v ?? DASH)),
  }
  return fmt
}

export type Format = ReturnType<typeof make>

const cache = new Map<Lang, Format>()

export function formatters(lang: Lang): Format {
  let f = cache.get(lang)
  if (!f) cache.set(lang, (f = make(lang)))
  return f
}

export function useFormat(): Format {
  return formatters(useApp().lang)
}
