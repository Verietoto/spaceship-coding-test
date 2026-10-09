// One filter control, whichever kind it is: a list of values (with counts), a number range, or the arrival dates. Shared by the main
// filter bar (its changes go through the app, which remembers what the AI set) and a dashboard's own bar (local state).
import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { filters as filtersMsg } from '../i18n/filters'
import { DIMENSIONS, RANGE_KEYS } from '../lib/types'
import type { AIKey, Dimension, Facets, Filters, RangeKey } from '../lib/types'
import { DateRangeInput } from './DateRangeInput'
import type { IconName } from './Icon'
import { MultiSelect } from './MultiSelect'
import { RangeInput } from './RangeInput'
import { useValueLabel } from './useValueLabel'

export type Field = Dimension | RangeKey | 'arrived'
/** The filters the bar always shows, and the ones in its "more filters" panel. */
export const CORE: Dimension[] = ['region', 'warehouse', 'carrier', 'client']
export const MORE: Field[] = ['category', 'status', 'promo', 'origin', 'destination', 'sku', 'value', 'quantity', 'lead', 'age', 'arrived']

export const ICONS: Record<Field, IconName> = {
  region: 'pin', warehouse: 'warehouse', carrier: 'truck', client: 'clients', category: 'box', status: 'check', promo: 'award',
  origin: 'pin', destination: 'pin', sku: 'box', value: 'dollar', quantity: 'box', lead: 'clock', age: 'timer', arrived: 'calendar',
}
const ALL = {
  region: 'all_regions', warehouse: 'all_warehouses', carrier: 'all_carriers', client: 'all_clients', category: 'all_categories',
  status: 'all_statuses', promo: 'all_promo', origin: 'all_origins', destination: 'all_destinations', sku: 'all_skus',
} as const

export type Handlers = {
  setDim: (dim: Dimension, values: string[], exclude: boolean) => void
  setBounds: (key: RangeKey, lo: number | null, hi: number | null) => void
  setArrived: (start: string | null, end: string | null) => void
}

type Props = { field: Field; f: Filters; facets?: Facets; ai?: Partial<Record<AIKey, boolean>>; on: Handlers }

const isDimension = (field: Field): field is Dimension => (DIMENSIONS as readonly string[]).includes(field)
const isRange = (field: Field): field is RangeKey => (RANGE_KEYS as readonly string[]).includes(field)

export function FilterField({ field, f, facets, ai = {}, on }: Props) {
  const t = useMessages(filtersMsg)
  const tc = useMessages(common)
  const valueLabel = useValueLabel()
  if (isDimension(field)) {
    return (
      <MultiSelect
        label={tc(`f_${field}`)}
        icon={ICONS[field]}
        allLabel={t(ALL[field])}
        options={facets?.[field] ?? f[field].map((value) => ({ value, n: 0 }))}
        selected={f[field]}
        exclude={f.exclude.includes(field)}
        isAI={ai[field]}
        format={(v) => valueLabel(field, v)}
        note={field === 'status' ? t('status_note') : undefined}
        hint={field === 'warehouse' ? (o) => o.region : undefined}
        onChange={(values, exclude) => on.setDim(field, values, exclude)}
      />
    )
  }
  if (isRange(field)) {
    const value = f.ranges[field]
    return (
      <RangeInput
        key={`${field}:${value?.[0] ?? ''}:${value?.[1] ?? ''}`}
        label={tc(`f_${field}`)}
        icon={ICONS[field]}
        bounds={facets?.ranges[field]}
        value={value}
        isAI={ai[field]}
        note={field === 'lead' ? t('arrived_note') : undefined}
        onChange={(lo, hi) => on.setBounds(field, lo, hi)}
      />
    )
  }
  return <DateRangeInput label={tc('f_arrived')} bounds={facets?.ranges.arrived} start={f.arrived_start} end={f.arrived_end} isAI={ai.arrived} note={t('arrived_note')} onChange={on.setArrived} />
}
