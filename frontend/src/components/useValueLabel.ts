// How a filter value reads on screen: order statuses and the promo flag are codes in the data ("in_transit", "1"), words for people.
import { useMessages } from '../i18n'
import { filters as filtersMsg } from '../i18n/filters'
import type { Bounds, Dimension } from '../lib/types'

const STATUSES = ['delivered', 'delayed', 'in_transit', 'exception', 'canceled'] as const

export function useValueLabel(): (dim: Dimension, value: string) => string {
  const t = useMessages(filtersMsg)
  return (dim, v) => {
    if (dim === 'promo') return t(v === '1' ? 'promo_1' : 'promo_0')
    const status = STATUSES.find((s) => s === v)
    return dim === 'status' && status ? t(`status_${status}`) : v
  }
}

/** A number range as text: "10–50", "≥ 10", "≤ 50". */
export function useRangeText(): (b: Bounds) => string {
  const t = useMessages(filtersMsg)
  return ([lo, hi]) => (lo !== null && hi !== null ? t('range_both', { lo, hi }) : lo !== null ? t('range_from', { lo }) : t('range_to', { hi: hi ?? '' }))
}
