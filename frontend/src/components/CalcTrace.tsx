// "How this is calculated": the filters (each value in its own highlighted shape), the rows counted, and the maths drawn as
// maths (fractions, Σ, the result highlighted), never the SQL.
import { useMessages } from '../i18n'
import { calc as calcMsg } from '../i18n/calc'
import { common } from '../i18n/common'
import { useFormat } from '../i18n/format'
import type { Calc } from '../lib/types'
import { MetricFormula, TextFormula } from './Formula'
import { Icon } from './Icon'
import { useFilterParts } from './useFilterLines'

export function CalcTrace({ calc, label }: { calc: Calc; label?: string }) {
  const t = useMessages(calcMsg)
  const tc = useMessages(common)
  const fmt = useFormat()
  const filterParts = useFilterParts()
  const parts = calc.filters ? filterParts(calc.filters) : []
  const hasFormulas = calc.metrics.length > 0 || (calc.formulas?.length ?? 0) > 0

  return (
    <details className="calc">
      <summary>
        <Icon name="sparkle" size={14} /> {label ?? t('button')}
      </summary>
      <dl>
        {calc.filters && (
          <>
            <dt>{t('filters')}</dt>
            <dd className="fparts">
              {parts.map((p) => (
                <div key={p.key} className="fpart">
                  <span className="fpart-k">{p.label}</span>
                  {p.except && <span className="fv-not">{tc('except')}</span>}
                  {p.values.map((v) => <span key={v} className={`fv ${p.key}`}>{v}</span>)}
                </div>
              ))}
              {parts.length === 1 && <div className="fpart-none">{t('no_dims')}</div>}
            </dd>
          </>
        )}
        {calc.rows != null && (
          <>
            <dt>{t('rows')}</dt>
            <dd>{t('rows_value', { a: fmt.int(calc.rows), b: fmt.int(calc.total) })}</dd>
          </>
        )}
        {hasFormulas && (
          <>
            <dt>{t('formulas')}</dt>
            <dd className="fxs">
              {calc.metrics.map((m) => <MetricFormula key={m} metric={m} terms={calc.terms?.[m]} />)}
              {(calc.formulas ?? []).map((x, i) => <TextFormula key={i} text={x} />)}
            </dd>
          </>
        )}
      </dl>
    </details>
  )
}
