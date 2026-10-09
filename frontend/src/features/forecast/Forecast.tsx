// 5. Demand forecast: orders or units per month as a line chart (actual, the chosen method's forecast, its 80% range). The method
// is the user's to pick (the one with the best backtest is the default); units also get an inventory recommendation.
import { useState } from 'react'
import { useApi } from '../../app/useApi'
import { useApp } from '../../app/useApp'
import { GlowIcon } from '../../components/GlowIcon'
import { Hint } from '../../components/Hint'
import { SectionHead } from '../../components/SectionHead'
import { Seg } from '../../components/Seg'
import { Status } from '../../components/Status'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { forecast } from '../../i18n/forecast'
import { useFormat } from '../../i18n/format'
import { fq } from '../../lib/api'
import { forecastRows } from '../../lib/forecastRows'
import { ForecastChart } from './ForecastChart'
import { InventoryCard } from './InventoryCard'
import { MethodCard } from './MethodCard'
import type { ForecastData, MethodName, Metric } from './types'

const HORIZONS = [3, 4, 6] as const
const SERVICES = [80, 90, 95] as const

export function Forecast() {
  const { view, meta } = useApp()
  const t = useMessages(forecast)
  const tc = useMessages(common)
  const fmt = useFormat()
  const [metric, setMetric] = useState<Metric>('orders')
  const [category, setCategory] = useState('')
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(3)
  const [service, setService] = useState<(typeof SERVICES)[number]>(90)
  const [picked, setPicked] = useState<MethodName | null>(null) // null = the method with the best backtest
  const { data, error, isLoading } = useApi<ForecastData>('forecast', { ...fq(view.f), metric, horizon, service: service / 100, ...(category && { category }) })
  if (!data) return <Status isLoading={isLoading} error={error} />

  const selected = picked ?? data.method
  const method = data.methods.find((m) => m.name === selected) ?? data.methods[0]
  const rows = forecastRows(data.history, data.history_start, method.points)
  const p0 = method.points[0]
  const title = `${t(metric === 'units' ? 'title_units' : 'title_orders')}${category ? ` · ${category}` : ''}`
  const next = t(metric === 'units' ? 'next_units' : 'next_orders', { v: method.points.map((p) => fmt.num0(p.mid)).join(' · ') })
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPicked(null)
  }

  return (
    <>
      <SectionHead title={tc('nav_forecast')} question={t('question')} />
      <section className="card glow-host">
        <div className="card-head">
          <div className="card-title">
            <GlowIcon name="forecast" tone="t2" />
            <h3><Hint text={t('limit')}>{title}</Hint></h3>
          </div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <Seg label={t('metric_label')} value={metric} onChange={reset(setMetric)} options={[['orders', t('metric_orders')], ['units', t('metric_units')]]} />
          <select className="sel" aria-label={t('category_label')} value={category} onChange={(e) => reset(setCategory)(e.target.value)}>
            <option value="">{t('all_categories')}</option>
            {(meta?.categories ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Seg label={t('horizon_label')} value={horizon} onChange={setHorizon} options={HORIZONS.map((n) => [n, t('horizon', { n })])} />
          {metric === 'units' && <Seg label={t('service_label')} value={service} onChange={setService} options={SERVICES.map((s) => [s, `${s}%`])} />}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <Seg
            label={t('method_title')}
            value={selected}
            onChange={setPicked}
            options={data.methods.map((m) => [m.name, `${t(`n_${m.name}`)}${m.name === data.method ? ` · ${t('best')}` : ''}`])}
          />
        </div>
        <ForecastChart rows={rows} label={title} />
        <div className="legend-row">
          <span><span className="swatch" style={{ background: 'var(--bar-good)' }} />{t('actual')}</span>
          <span><span className="swatch" style={{ background: 'var(--series-1)' }} />{t('forecast')}</span>
          <span><span className="swatch" style={{ background: 'var(--line3)' }} />{t('range')}</span>
        </div>
        <div className="stat-row">
          <div>
            <div className="lab">{t('lbl_next', { n: method.points.length })}</div>
            <div className="big">{next}</div>
            <div className="muted xsmall">{t('range_value', { lo: fmt.num0(p0.lo), hi: fmt.num0(p0.hi) })}</div>
          </div>
          <div>
            <div className="lab">{t('lbl_wape')}</div>
            <div className="big">{t('wape_value', { m: fmt.pct0(method.wape == null ? null : method.wape * 100), n: fmt.pct0(data.naive.wape == null ? null : data.naive.wape * 100) })}</div>
          </div>
        </div>
      </section>
      <MethodCard data={data} selected={selected} />
      {method.inventory && <InventoryCard inv={method.inventory} />}
    </>
  )
}
