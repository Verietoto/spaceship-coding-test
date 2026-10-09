// 1. Overview: headline KPIs vs a comparison, delay trend, lead-time distribution.
import { useState } from 'react'
import { useApi } from '../../app/useApi'
import { useApp } from '../../app/useApp'
import { BarChart } from '../../components/BarChart'
import type { BarDatum } from '../../components/BarChart'
import { CalcTrace } from '../../components/CalcTrace'
import { Callout } from '../../components/Callout'
import { GlowIcon } from '../../components/GlowIcon'
import { KpiCard } from '../../components/KpiCard'
import { SectionHead } from '../../components/SectionHead'
import { Seg } from '../../components/Seg'
import { Status } from '../../components/Status'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { useFormat } from '../../i18n/format'
import { overview } from '../../i18n/overview'
import { fq } from '../../lib/api'
import { niceAxis } from '../../lib/scale'
import { delta } from '../../lib/delta'
import { buckets } from '../../lib/period'
import type { Calc, Stats } from '../../lib/types'

type OverviewData = {
  stats: Stats
  compare: { mode: string; range?: { start: string; end: string } | null; stats: Stats | null }
  trend: { g: string; n: number; delay: number }[]
  trend_base: { g: string; n: number; delay: number }[] | null
  window: { start: string; end: string }
  hist: { bin: number; n: number }[]
  calc: Calc
}

export function Overview() {
  const { view } = useApp()
  const t = useMessages(overview)
  const tc = useMessages(common)
  const fmt = useFormat()
  const { f, compare } = view
  const [gran, setGran] = useState<'month' | 'quarter'>('month')
  const [histMode, setHistMode] = useState<'pct' | 'count'>('pct')
  const { data, error, isLoading } = useApi<OverviewData>('overview', { ...fq(f), compare, gran })

  if (!data) return <Status isLoading={isLoading} error={error} />
  const s = data.stats
  const b = data.compare.stats
  const cmpLabel =
    compare === 'none'
      ? ''
      : data.compare.mode === 'base'
        ? b
          ? t('vs_all')
          : t('no_cmp_base')
        : data.compare.range
          ? t('vs', { v: fmt.range(data.compare.range.start, data.compare.range.end) })
          : f.start || f.end
            ? t('no_data_before')
            : t('no_cmp_prev')

  const isMonth = gran === 'month'
  const bks = buckets(data.window, gran)
  const multiYear = bks[0].year !== bks[bks.length - 1].year
  const byKey = new Map(data.trend.map((r) => [r.g, r]))
  const baseBy = new Map(data.trend_base?.map((r) => [r.g, r.delay]))
  const trend: BarDatum[] = bks.map((b) => {
    const row = byKey.get(b.key)
    const quarter = `Q${b.index}${multiYear ? ` ’${String(b.year).slice(2)}` : ''}`
    return {
      label: isMonth ? (multiYear ? fmt.monthYear(b.key) : fmt.month(b.index)) : quarter,
      value: row?.delay ?? null,
      valueText: row ? fmt.pct0(row.delay) : '–',
      sub: t('n', { n: row?.n ?? 0 }),
      dim: !((!f.start || b.end >= f.start) && (!f.end || b.start <= f.end)), // outside the selected range
      marker: baseBy.get(b.key) ?? null,
    }
  })
  const trendAxis = niceAxis([...trend.map((d) => d.value), ...trend.map((d) => d.marker)], 10)

  const histTotal = data.hist.reduce((a, r) => a + r.n, 0)
  const hist: BarDatum[] = [2, 3, 4, 5, 6, 7, 8, 9].map((bin) => {
    const n = data.hist.find((r) => r.bin === bin)?.n ?? 0
    const v = histMode === 'pct' ? (histTotal ? (n / histTotal) * 100 : 0) : n
    return {
      label: bin === 2 ? '≤2' : bin === 9 ? '9+' : String(bin),
      value: v,
      valueText: histMode === 'pct' ? fmt.pct0(v) : fmt.int(n),
      tone: bin >= 8 ? 'warn' : 'good',
    }
  })
  const histAxis = niceAxis(hist.map((d) => d.value), histMode === 'pct' ? 30 : 10)

  return (
    <>
      <SectionHead title={tc('nav_overview')} question={t('question')} />
      {s.n === 0 ? (
        <p className="note">{tc('no_data')}</p>
      ) : (
        <>
          <div className="kpi-grid">
            <KpiCard icon="box" tone="t1" label={t('k_orders')} value={fmt.int(s.n)} delta={delta(s.n, b?.n ?? null, 'rel')} cmpLabel={cmpLabel} sub={t('s_orders')} hint={t('h_orders')} />
            <KpiCard icon="dollar" tone="t2" label={t('k_value')} value={fmt.usd(s.val)} delta={delta(s.val, b?.val ?? null, 'rel')} cmpLabel={cmpLabel} sub={t('s_value', { v: fmt.usd2(s.aov) })} hint={t('h_value')} />
            <KpiCard icon="truck" tone="t3" label={t('k_deliv')} value={fmt.pct0(s.deliv)} delta={delta(s.deliv, b?.deliv ?? null, 'pt', 'down')} cmpLabel={cmpLabel} sub={t('s_deliv')} hint={t('h_deliv')} />
            <KpiCard
              icon="clock"
              tone="t4"
              label={t('k_delay')}
              value={fmt.pct1(s.delay)}
              isBad={s.delay != null && s.delay > 10}
              delta={delta(s.delay, b?.delay ?? null, 'pt', 'up')}
              cmpLabel={cmpLabel}
              sub={t('s_delay')}
              hint={t('h_delay')}
            />
            <KpiCard
              icon="award"
              tone="t5"
              label={t('k_p90')}
              value={fmt.days(s.p90)}
              delta={delta(s.p90, b?.p90 ?? null, 'd', 'up')}
              cmpLabel={cmpLabel}
              sub={t('s_p90', { a: fmt.days(s.p50), b: fmt.days(s.mean) })}
              hint={t('h_p90')}
            />
            <KpiCard icon="timer" tone="t6" label={t('k_over7')} value={fmt.pct1(s.over7)} delta={delta(s.over7, b?.over7 ?? null, 'pt', 'up')} cmpLabel={cmpLabel} sub={t('s_over7')} hint={t('h_over7')} />
          </div>
          <CalcTrace calc={data.calc} />

          <div className="grid-2">
            <section className="card glow-host">
              <div className="card-head">
                <div className="card-title">
                  <GlowIcon name="forecast" tone="t6" />
                  <div>
                    <h3>{t(isMonth ? 'trend_title' : 'trend_title_q')}</h3>
                    <p>{t(isMonth ? 'trend_sub' : 'trend_sub_q')}</p>
                  </div>
                </div>
                <Seg label={t('trend_title')} value={gran} onChange={setGran} options={[['month', t('per_month')], ['quarter', t('per_quarter')]]} />
              </div>
              <BarChart data={trend} max={trendAxis.max} step={trendAxis.step} axis={(v) => fmt.pct0(v)} label={t(isMonth ? 'trend_title' : 'trend_title_q')} />
              <Callout>
                {t('trend_note', { max: fmt.pct0(trendAxis.max), g: t(isMonth ? 'g_month' : 'g_quarter') })}
                {data.trend_base ? t('trend_note_base') : ''}
              </Callout>
            </section>

            <section className="card glow-host">
              <div className="card-head">
                <div className="card-title">
                  <GlowIcon name="hist" tone="t2" />
                  <div>
                    <h3>{t('hist_title')}</h3>
                    <p>{t('hist_sub', { n: fmt.int(s.lead_n) })}</p>
                  </div>
                </div>
                <Seg label={t('hist_title')} value={histMode} onChange={setHistMode} options={[['pct', t('pct')], ['count', t('count')]]} />
              </div>
              <BarChart
                data={hist}
                max={histAxis.max}
                step={histAxis.step}
                axis={(v) => (histMode === 'pct' ? fmt.pct0(v) : fmt.int(v))}
                label={t('hist_title')}
              />
              <div className="legend-row">
                <span><span className="swatch" style={{ background: 'var(--bar-good)' }} />{t('within_sla')}</span>
                <span><span className="swatch" style={{ background: 'var(--bar-warn)' }} />{t('over_sla')}</span>
              </div>
              <Callout tone="ok">{t('hist_note', { a: fmt.days(s.p50), b: fmt.days(s.p90), c: fmt.pct1(s.over7), d: fmt.days(s.mean) })}</Callout>
            </section>
          </div>
        </>
      )}
    </>
  )
}
