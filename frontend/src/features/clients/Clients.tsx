// 3. Clients: concentration, clients over the delay threshold, value at risk; click a client to see its problem orders.
import { useState } from 'react'
import { useApi } from '../../app/useApi'
import { useApp } from '../../app/useApp'
import { CalcTrace } from '../../components/CalcTrace'
import { GlowIcon } from '../../components/GlowIcon'
import type { Tone } from '../../components/GlowIcon'
import type { IconName } from '../../components/Icon'
import { SectionHead } from '../../components/SectionHead'
import { Seg } from '../../components/Seg'
import { SmallSample } from '../../components/SmallSample'
import { Status } from '../../components/Status'
import { useMessages } from '../../i18n'
import { clients } from '../../i18n/clients'
import { common } from '../../i18n/common'
import { useFormat } from '../../i18n/format'
import { fq } from '../../lib/api'
import { isOnly } from '../../lib/filterQuery'
import type { Calc, Keyed } from '../../lib/types'

type ClientsData = {
  clients: Keyed[]
  top5_share: number | null
  top5: string[]
  flagged: string[]
  at_risk_value: number
  total_value: number
  calc: Calc
}

export function Clients() {
  const { view, setOnly, go } = useApp()
  const t = useMessages(clients)
  const tc = useMessages(common)
  const fmt = useFormat()
  const [sortKey, setSortKey] = useState<'val' | 'delay' | 'prob_val'>('val')
  const [showAll, setShowAll] = useState(false)
  const { data, error, isLoading } = useApi<ClientsData>('clients', fq(view.f))
  if (!data) return <Status isLoading={isLoading} error={error} />

  const sorted = [...data.clients].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0))
  const rows = showAll ? sorted : sorted.slice(0, 10)
  const riskPct = data.total_value ? (data.at_risk_value / data.total_value) * 100 : null
  const stats: { icon: IconName; tone: Tone; label: string; value: string; sub: string; bad?: boolean }[] = [
    { icon: 'clients', tone: 't1', label: t('top5'), value: fmt.pct1(data.top5_share), sub: t('top5_sub', { v: data.top5.join(', ') }) },
    { icon: 'risk', tone: 't4', label: t('flagged'), value: fmt.int(data.flagged.length), sub: `${t('flagged_sub')}${data.flagged.length ? ` · ${data.flagged.join(', ')}` : ''}`, bad: data.flagged.length > 0 },
    { icon: 'dollar', tone: 't6', label: t('risk'), value: fmt.usd(data.at_risk_value), sub: t('risk_sub', { p: fmt.pct1(riskPct) }) },
  ]

  return (
    <>
      <SectionHead title={tc('nav_clients')} question={t('question')} />
      <div className="stat-grid">
        {stats.map((st) => (
          <div key={st.label} className="card kpi glow-host">
            <div className="kpi-head">
              <GlowIcon name={st.icon} tone={st.tone} />
              <span className="lab">{st.label}</span>
            </div>
            <span className={`kpi-value${st.bad ? ' bad' : ''}`}>{st.value}</span>
            <div className="kpi-sub">{st.sub}</div>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="card-head">
          <div className="card-title">
            <div>
              <h3>{t('table')}</h3>
              <p>{t('click')}</p>
            </div>
          </div>
          <Seg label={tc('sort_by')} value={sortKey} onChange={setSortKey} options={[['val', t('by_value')], ['delay', tc('by_delay')], ['prob_val', t('by_risk')]]} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tc('f_client')}</th>
                <th className="num">{tc('col_orders')}</th>
                <th className="num">{tc('col_value')}</th>
                <th className="num">{tc('col_delay')}</th>
                <th className="num">{t('col_open')}</th>
                <th className="num">{t('col_risk')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.key} className={isOnly(view.f, 'client', c.key) ? 'selected' : ''}>
                  <td>
                    <button
                      type="button"
                      className="row-btn"
                      onClick={() => {
                        setOnly('client', c.key)
                        go('risk')
                      }}
                    >
                      {c.key}
                    </button>
                    <SmallSample n={c.n} />
                  </td>
                  <td className="num muted">{fmt.int(c.n)}</td>
                  <td className="num">
                    {fmt.usd(c.val)} <span className="muted">({fmt.pct1(data.total_value ? (c.val / data.total_value) * 100 : null)})</span>
                  </td>
                  <td className={`num ${c.delay != null && c.delay > 20 ? 'bad' : ''}`} style={{ fontWeight: 700 }}>{fmt.pct1(c.delay)}</td>
                  <td className="num">{fmt.int(c.open)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{fmt.usd(c.prob_val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length > 10 && (
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn ghost" onClick={() => setShowAll(!showAll)}>
              {showAll ? t('show_top') : t('show_all', { n: sorted.length })}
            </button>
          </div>
        )}
        <CalcTrace calc={data.calc} />
      </section>
    </>
  )
}
