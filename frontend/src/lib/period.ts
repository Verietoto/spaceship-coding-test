// Periods: presets (full year, half, quarter, month) as date ranges, and the buckets of the trend chart.
export type PresetCode = 'FY' | 'H1' | 'H2' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | `M${number}`
export const PRESET_CODES: PresetCode[] = ['FY', 'H1', 'H2', 'Q1', 'Q2', 'Q3', 'Q4', ...Array.from({ length: 12 }, (_, i): PresetCode => `M${i + 1}`)]

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** [firstMonth, monthCount] of a preset. */
function span(code: PresetCode): [number, number] {
  if (code === 'FY') return [1, 12]
  if (code === 'H1') return [1, 6]
  if (code === 'H2') return [7, 6]
  if (code[0] === 'Q') return [(Number(code[1]) - 1) * 3 + 1, 3]
  return [Number(code.slice(1)), 1]
}

export function presetRange(code: PresetCode, year: number): [string, string] {
  const [m, n] = span(code)
  return [iso(year, m, 1), iso(year, m + n - 1, lastDay(year, m + n - 1))]
}

/** The preset a range equals (any year), or null for a custom range. */
export function matchPreset(start: string | null, end: string | null): { code: PresetCode; year: number } | null {
  if (!start || !end) return null
  const year = Number(start.slice(0, 4))
  const code = PRESET_CODES.find((c) => presetRange(c, year).join() === `${start},${end}`)
  return code ? { code, year } : null
}

/** Presets that overlap the data, newest year first. */
export function presetsFor(years: number[], bounds: { min: string; max: string }): { code: PresetCode; year: number }[] {
  return [...years].reverse().flatMap((year) =>
    PRESET_CODES.filter((code) => {
      const [s, e] = presetRange(code, year)
      return e >= bounds.min && s <= bounds.max
    }).map((code) => ({ code, year })),
  )
}

export type Bucket = { key: string; start: string; end: string; year: number; index: number }

/** Every month (or quarter) from Jan 1 of the window's first year to Dec 31 of its last, even where there is no data. */
export function buckets(window: { start: string; end: string }, gran: 'month' | 'quarter'): Bucket[] {
  const out: Bucket[] = []
  for (let y = Number(window.start.slice(0, 4)); y <= Number(window.end.slice(0, 4)); y++) {
    for (let i = 1; i <= (gran === 'month' ? 12 : 4); i++) {
      const [m, n] = gran === 'month' ? [i, 1] : [(i - 1) * 3 + 1, 3]
      out.push({ key: gran === 'month' ? `${y}-${pad(i)}` : `${y}-Q${i}`, start: iso(y, m, 1), end: iso(y, m + n - 1, lastDay(y, m + n - 1)), year: y, index: i })
    }
  }
  return out
}

/** "2025-03" + 2 -> "2025-05" */
export function addMonths(ym: string, n: number): string {
  const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`
}

/** The calendar month or quarter holding the newest data: what "last month / last quarter" means for this data set. */
export function latestRange(kind: 'month' | 'quarter', max: string): [string, string] {
  const year = Number(max.slice(0, 4))
  const month = Number(max.slice(5, 7))
  return presetRange(kind === 'month' ? `M${month}` : (`Q${Math.ceil(month / 3)}` as PresetCode), year)
}
