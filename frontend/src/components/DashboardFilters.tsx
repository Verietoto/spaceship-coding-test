// The filters a saved dashboard offers (the agent that built it chose them): only those, with the same controls as the main
// filter bar, but on state of their own: they never change the main dashboard's filters.
import { useApi } from '../app/useApi'
import { useApp } from '../app/useApp'
import { useMessages } from '../i18n'
import { filters as filtersMsg } from '../i18n/filters'
import { fq } from '../lib/api'
import { withRange, withValues } from '../lib/filterQuery'
import type { DashFilter, Dimension, Facets, Filters } from '../lib/types'
import { DIMENSIONS } from '../lib/types'
import type { Field, Handlers } from './FilterField'
import { FilterField } from './FilterField'
import { PeriodPicker } from './PeriodPicker'

type Props = { specs: DashFilter[]; value: Filters; onChange: (f: Filters) => void; onReset: () => void; isDefault: boolean }

export function DashboardFilters({ specs, value, onChange, onReset, isDefault }: Props) {
  const { meta } = useApp()
  const t = useMessages(filtersMsg)
  const { data } = useApi<Facets>('facets', fq(value))
  const bounds = data?.bounds ?? meta?.bounds
  const years = data?.years ?? meta?.years ?? []
  // local state of its own: these never change the main dashboard's filters
  const on: Handlers = {
    setDim: (dim: Dimension, values, exclude) => onChange(withValues(value, dim, values, exclude)),
    setBounds: (key, lo, hi) => onChange(withRange(value, key, lo, hi)),
    setArrived: (start, end) => onChange({ ...value, arrived_start: start, arrived_end: end }),
  }
  const fields = specs.map((s) => s.key).filter((k): k is Field => k !== 'period' && (k === 'arrived' || (DIMENSIONS as readonly string[]).includes(k) || ['value', 'quantity', 'lead', 'age'].includes(k)))

  return (
    <div className="filterbar">
      <div className="card filter-card">
        {specs.some((s) => s.key === 'period') && bounds && (
          <PeriodPicker years={years} bounds={bounds} value={{ start: value.start, end: value.end }} onChange={(start, end) => onChange({ ...value, start, end })} />
        )}
        {fields.map((field) => (
          <FilterField key={field} field={field} f={value} facets={data} on={on} />
        ))}
        <div className="filter-buttons">
          <button type="button" className="btn ghost" onClick={onReset} disabled={isDefault}>
            {t('reset')}
          </button>
        </div>
      </div>
    </div>
  )
}
