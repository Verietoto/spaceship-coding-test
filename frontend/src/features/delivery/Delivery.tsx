// 2. Delivery performance: carrier ranking with a 10% target line, carrier × region heatmap, warehouses by region.
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useApi } from '../../app/useApi'
import { useApp } from '../../app/useApp'
import { CalcTrace } from '../../components/CalcTrace'
import { GlowIcon } from '../../components/GlowIcon'
import { SectionHead } from '../../components/SectionHead'
import { Seg } from '../../components/Seg'
import { SmallSample } from '../../components/SmallSample'
import { Status } from '../../components/Status'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { delivery } from '../../i18n/delivery'
import { useFormat } from '../../i18n/format'
import { fq } from '../../lib/api'
import { isOnly } from '../../lib/filterQuery'
import type { Calc, Keyed } from '../../lib/types'

type DeliveryData = {
  carriers: Keyed[]
  heat: { carrier: string; region: string; n: number; delay: number }[]
  warehouses: (Keyed & { region: string })[]
  calc: Calc
}

const TARGET = 10
const SCALE = 25 // bar width: 0–25% delay

export function Delivery() {
  const { view, focusValue, meta } = useApp()
  const t = useMessages(delivery)
  const tc = useMessages(common)
  const fmt = useFormat()
  const [sortKey, setSortKey] = useState<'delay' | 'p90'>('delay')
  const { data, error, isLoading } = useApi<DeliveryData>('delivery', fq(view.f))
  if (!data || !meta) return <Status isLoading={isLoading} error={error} />

  const carriers = [...data.carriers].sort((a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1))
  const heat = new Map(data.heat.map((h) => [`${h.carrier}|${h.region}`, h]))
  const isOver = (v: number | null) => v != null && v > TARGET

  return (
    <>
      <SectionHead title={tc('nav_delivery')} question={t('question')} />
      <div className="grid-even">
        <section className="card glow-host">
          <div className="card-head">
            <div className="card-title">
              <GlowIcon name="truck" tone="t3" />
              <div>
                <h3>{t('carrier_rank')}</h3>
                <p>{t('click_focus')}</p>
              </div>
            </div>
            <Seg label={tc('sort_by')} value={sortKey} onChange={setSortKey} options={[['delay', tc('by_delay')], ['p90', t('by_p90')]]} />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tc('f_carrier')}</th>
                  <th className="num">{tc('col_orders')}</th>
                  <th>{tc('col_delay')}</th>
                  <th className="num">{tc('col_p90')}</th>
                  <th className="num">{tc('col_over7')}</th>
                </tr>
              </thead>
              <tbody>
                {carriers.map((c) => (
                  <tr key={c.key} className={isOnly(view.f, 'carrier', c.key) ? 'selected' : ''}>
                    <td>
                      <button type="button" className="row-btn" onClick={() => focusValue('carrier', c.key)}>
                        {c.key}
                      </button>
                      <SmallSample n={c.n} />
                    </td>
                    <td className="num muted">{fmt.int(c.n)}</td>
                    <td>
                      <span className="rank-cell">
                        <span className="rank-bar">
                          <span className={isOver(c.delay) ? 'over' : ''} style={{ width: `${Math.min(100, ((c.delay ?? 0) / SCALE) * 100)}%` }} />
                          <i style={{ left: `${(TARGET / SCALE) * 100}%` }} />
                        </span>
                        <b className={isOver(c.delay) ? 'bad' : 'good'}>{fmt.pct1(c.delay)}</b>
                      </span>
                    </td>
                    <td className="num">{fmt.days(c.p90)}</td>
                    <td className="num muted">{fmt.pct0(c.over7)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-note">{t('rank_note')}</p>
          <CalcTrace calc={data.calc} />
        </section>

        <section className="card glow-host">
          <div className="card-head">
            <div className="card-title">
              <GlowIcon name="pin" tone="t6" />
              <div>
                <h3>{t('heat_title')}</h3>
                <p>{t('heat_note')}</p>
              </div>
            </div>
          </div>
          <div className="heat-grid" style={{ '--cols': meta.regions.length } as CSSProperties}>
            <span />
            {meta.regions.map((r) => <span key={r} className="hdr">{r}</span>)}
            {meta.carriers.map((c) => [
              <span key={c} className="rowhdr">{c}</span>,
              ...meta.regions.map((r) => {
                const h = heat.get(`${c}|${r}`)
                if (!h) return <span key={`${c}${r}`} className="heat-cell empty" />
                const share = Math.min(h.delay / 50, 1)
                return (
                  <span
                    key={`${c}${r}`}
                    className={`heat-cell ${h.n < 5 ? 'thin' : ''} ${share > 0.55 ? 'dark' : ''}`}
                    style={{ background: `color-mix(in oklab, var(--heat-lo), var(--heat-hi) ${share * 100}%)` }}
                    title={t('heat_cell', { c, r, v: fmt.pct1(h.delay), n: h.n })}
                  >
                    {fmt.num0(h.delay)}
                  </span>
                )
              }),
            ])}
          </div>
          <div className="legend-row">
            <span>{fmt.pct0(0)}</span>
            <span className="heat-scale" />
            <span>{fmt.pct0(50)}+</span>
          </div>
        </section>
      </div>

      <section className="card glow-host">
        <div className="card-head">
          <div className="card-title">
            <GlowIcon name="warehouse" tone="t5" />
            <div>
              <h3>{t('wh_title')}</h3>
              <p>{t('wh_note')}</p>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tc('f_warehouse')}</th>
                <th>{tc('f_region')}</th>
                <th className="num">{tc('col_orders')}</th>
                <th className="num">{tc('col_delay')}</th>
                <th className="num">{t('th_mean')}</th>
                <th className="num">{tc('col_p90')}</th>
                <th className="num">{tc('col_value')}</th>
              </tr>
            </thead>
            <tbody>
              {meta.regions.flatMap((r) =>
                data.warehouses
                  .filter((w) => w.region === r)
                  .map((w) => (
                    <tr key={w.key} className={isOnly(view.f, 'warehouse', w.key) ? 'selected' : ''}>
                      <td>
                        <button type="button" className="row-btn" onClick={() => focusValue('warehouse', w.key)}>
                          {w.key}
                        </button>
                      </td>
                      <td className="muted">{w.region}</td>
                      <td className="num muted">{fmt.int(w.n)}</td>
                      <td className={`num ${isOver(w.delay) ? 'bad' : 'good'}`} style={{ fontWeight: 700 }}>{fmt.pct1(w.delay)}</td>
                      <td className="num">{fmt.days(w.mean)}</td>
                      <td className="num">{fmt.days(w.p90)}</td>
                      <td className="num">{fmt.usd(w.val)}</td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
