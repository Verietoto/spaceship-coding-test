// 4. Risk & exceptions: open problem orders ranked by business impact, with a reading of the selected order.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useApi } from '../../app/useApi'
import { useApp } from '../../app/useApp'
import { CalcTrace } from '../../components/CalcTrace'
import { GlowIcon } from '../../components/GlowIcon'
import { Icon } from '../../components/Icon'
import { SectionHead } from '../../components/SectionHead'
import { Seg } from '../../components/Seg'
import { Status } from '../../components/Status'
import { useMessages } from '../../i18n'
import type { Translate } from '../../i18n'
import { common } from '../../i18n/common'
import { useFormat } from '../../i18n/format'
import type { Format } from '../../i18n/format'
import { risk } from '../../i18n/risk'
import { fq } from '../../lib/api'
import type { Calc } from '../../lib/types'

export type RiskOrder = {
  order_id: string
  client_id: string
  carrier: string
  warehouse: string
  region: string
  status: string
  origin_city: string
  destination_city: string
  order_value_usd: number
  lead_days: number | null
  age_days: number
  client_value: number
  days: number
}
type RiskData = { orders: RiskOrder[]; carrier_lead: Record<string, { mean: number; n: number }>; total_value: number; calc: Calc }
export type Reading = { text: string; basis: string }

const STATUS = { in_transit: 'st_in_transit', exception: 'st_exception', delayed: 'st_delayed' } as const
const statusKey = (s: string) => STATUS[s as keyof typeof STATUS] ?? 'st_delayed'

/** Rule-based reading of one order; `explain` (from the Copilot) can replace it with an AI explanation. */
function orderBasis(o: RiskOrder, data: RiskData, t: Translate<typeof risk>, fmt: Format): Reading {
  const cl = data.carrier_lead[o.carrier]
  const m = fmt.days(cl?.mean)
  const vars = { d: o.days, m, c: o.carrier, r: `${o.origin_city} → ${o.destination_city}` }
  const text = o.status === 'in_transit' ? t('explain_stuck', vars) : o.status === 'exception' ? t('explain_exc', vars) : t('explain_delayed', vars)
  const basis = t('basis_text', {
    s: o.status,
    d: o.days,
    c: o.carrier,
    m,
    n: cl?.n ?? 0,
    k: o.client_id,
    p: fmt.pct1((o.client_value / data.total_value) * 100),
    v: fmt.usd2(o.order_value_usd),
  })
  return { text, basis }
}

type RiskProps = { explain?: (o: RiskOrder, reading: Reading) => ReactNode }

export function Risk({ explain }: RiskProps) {
  const { view, setOnly } = useApp()
  const t = useMessages(risk)
  const tc = useMessages(common)
  const fmt = useFormat()
  const [sort, setSort] = useState<'impact' | 'age' | 'value'>('impact')
  const [includeDelayed, setIncludeDelayed] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const { data, error, isLoading } = useApi<RiskData>('risk', { ...fq(view.f), sort, include_delayed: includeDelayed })
  if (!data) return <Status isLoading={isLoading} error={error} />

  const list = showAll ? data.orders : data.orders.slice(0, 10)
  const sel = data.orders.find((o) => o.order_id === selected)
  const reading = sel && orderBasis(sel, data, t, fmt)
  const mailto = sel && reading
    ? `mailto:?subject=${encodeURIComponent(t('draft_subject', { id: sel.order_id }))}&body=${encodeURIComponent(`${reading.text}\n\n${reading.basis}`)}`
    : undefined

  return (
    <>
      <SectionHead title={tc('nav_risk')} question={t('question')} />
      <div className="grid-risk">
        <section className="card glow-host">
          <div className="card-head">
            <div className="card-title">
              <GlowIcon name="risk" tone="t4" />
              <div>
                <h3>{t('list')}</h3>
                <p>{`${t('showing', { a: list.length, b: data.orders.length })} ${sort === 'impact' ? t('impact_note') : ''}`}</p>
              </div>
            </div>
            <Seg label={tc('sort_by')} value={sort} onChange={setSort} options={[['impact', t('by_impact')], ['age', t('by_age')], ['value', t('by_order_value')]]} />
          </div>
          <label className="check">
            <input type="checkbox" checked={includeDelayed} onChange={(e) => setIncludeDelayed(e.target.checked)} />
            {t('include_delayed')}
          </label>
          {data.orders.length === 0 ? (
            <p className="note" style={{ marginTop: 12 }}>{t('none')}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('th_order')}</th>
                    <th>{tc('f_client')}</th>
                    <th>{t('th_status')}</th>
                    <th className="num">{t('th_days')}</th>
                    <th className="num">{t('th_value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={o.order_id} className={o.order_id === selected ? 'selected' : ''}>
                      <td>
                        <button type="button" className="row-btn" aria-pressed={o.order_id === selected} onClick={() => setSelected(o.order_id)}>
                          <span className="order-id">{o.order_id}</span>
                        </button>
                        <span className="cell-sub">{o.origin_city} → {o.destination_city} · {o.carrier}</span>
                      </td>
                      <td>
                        <strong>{o.client_id}</strong>
                        <span className="cell-sub">{t('client_share', { p: fmt.pct1((o.client_value / data.total_value) * 100) })}</span>
                      </td>
                      <td className={`st-${o.status}`} style={{ fontWeight: 700, fontSize: 12 }}>{t(statusKey(o.status))}</td>
                      <td className="num">{fmt.int(o.days)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{fmt.usd2(o.order_value_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.orders.length > 10 && (
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowAll(!showAll)}>
                {showAll ? t('show_less') : t('show_all')}
              </button>
            </div>
          )}
          <CalcTrace calc={data.calc} />
        </section>

        {sel && reading ? (
          <section className="card ai explain-card glow-host">
            <div className="card-title">
              <GlowIcon name="sparkle" tone="ai" size={34} />
              <span className="lab ai">{t('explain_title')}</span>
            </div>
            <span className="order-id">{sel.order_id}</span>
            {explain ? explain(sel, reading) : <p>{reading.text}</p>}
            <p className="muted xsmall">{reading.basis}</p>
            <div className="row">
              <a className="btn primary" href={mailto}>
                <Icon name="mail" size={16} /> {t('draft')}
              </a>
              <button type="button" className="btn ghost" onClick={() => setOnly('client', sel.client_id)}>
                {t('see_client', { k: sel.client_id })}
              </button>
            </div>
          </section>
        ) : (
          <section className="card muted">{t('pick')}</section>
        )}
      </div>
    </>
  )
}
