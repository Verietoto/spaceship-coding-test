import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { calc } from '../i18n/calc'
import { useFormat } from '../i18n/format'
import { DIMENSIONS, RANGE_KEYS } from '../lib/types'
import type { Dimension, Filters, RangeKey } from '../lib/types'
import { useRangeText, useValueLabel } from './useValueLabel'

/** "Periode: Q4 2025", "Carrier: UPS, FedEx", "Region: kecuali EU" … for showing which filters a number used. */
export function useFilterLines(): (f: Filters) => string[] {
  const tc = useMessages(common)
  const t = useMessages(calc)
  const fmt = useFormat()
  const label = useValueLabel()
  const rangeText = useRangeText()
  return (f) => {
    const lines = [`${tc('f_period')}: ${fmt.range(f.start, f.end)}`]
    for (const d of DIMENSIONS) {
      if (f[d].length) lines.push(`${tc(`f_${d}`)}: ${f.exclude.includes(d) ? `${tc('except')} ` : ''}${f[d].map((v) => label(d, v)).join(', ')}`)
    }
    for (const k of RANGE_KEYS) {
      const b = f.ranges[k]
      if (b) lines.push(`${tc(`f_${k}`)}: ${rangeText(b)}`)
    }
    if (f.arrived_start || f.arrived_end) lines.push(`${tc('f_arrived')}: ${fmt.range(f.arrived_start, f.arrived_end)}`)
    if (lines.length === 1) lines.push(t('no_dims'))
    return lines
  }
}

export type FilterPart = { key: 'period' | 'arrived' | Dimension | RangeKey; label: string; values: string[]; except: boolean }

/** The active filters as parts (a label and its values), for drawing each value as its own highlighted shape. */
export function useFilterParts(): (f: Filters) => FilterPart[] {
  const tc = useMessages(common)
  const fmt = useFormat()
  const label = useValueLabel()
  const rangeText = useRangeText()
  return (f) => [
    { key: 'period', label: tc('f_period'), values: [fmt.range(f.start, f.end)], except: false },
    ...DIMENSIONS.filter((d) => f[d].length).map((d) => ({ key: d, label: tc(`f_${d}`), values: f[d].map((v) => label(d, v)), except: f.exclude.includes(d) })),
    ...RANGE_KEYS.filter((k) => f.ranges[k]).map((k) => ({ key: k, label: tc(`f_${k}`), values: [rangeText(f.ranges[k] ?? [null, null])], except: false })),
    ...(f.arrived_start || f.arrived_end ? [{ key: 'arrived' as const, label: tc('f_arrived'), values: [fmt.range(f.arrived_start, f.arrived_end)], except: false }] : []),
  ]
}

