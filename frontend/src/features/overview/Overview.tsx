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
import { compareNote } from '../../lib/compareNote'
import { niceAxis } from '../../lib/scale'
import { delta } from '../../lib/delta'
import { buckets } from '../../lib/period'
import type { Calc, Stats } from '../../lib/types'

import { CompareStrip } from './CompareStrip'

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
  const { data, error, isLoading } = useApi<OverviewData>('overview', { ...fq(f), compare, ...(compare === 'custom' && view.cmpRange ? { compare_start: view.cmpRange.start, compare_end: view.cmpRange.end } : {}), gran })

  if (!data) return <Status isLoading={isLoading} error={error} />
  const s = data.stats
  const b = data.compare.stats
  const note = compareNote(compare, data.compare, Boolean(f.start || f.end))
  const cr = data.compare.range
  const was = (v: string) => {
    if (!b) return undefined
    if (data.compare.mode === 'custom' && cr) return t('was_custom', { p: fmt.range(cr.start, cr.end), v })
    return t(data.compare.mode === 'base' ? 'was_all' : 'was_prev', { v })
  }

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
      markerText: baseBy.get(b.key) != null ? t('tip_base', { v: fmt.pct0(baseBy.get(b.key)!) }) : undefined,
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
          <CompareStrip
            note={note}
            current={[f.start, f.end]}
            previous={data.compare.range ? [data.compare.range.start, data.compare.range.end] : null}
          />
          <div className="kpi-grid" data-tour="kpis">
            <KpiCard icon="box" tone="t1" label={t('k_orders')} value={fmt.int(s.n)} delta={delta(s.n, b?.n ?? null, 'rel')} cmp={was(fmt.int(b?.n))} sub={t('s_orders')} hint={t('h_orders')} />
            <KpiCard icon="truck" tone="t3" label={t('k_deliv')} value={fmt.int(s.deliv_n)} delta={delta(s.deliv_n, b?.deliv_n ?? null, 'rel')} cmp={was(fmt.int(b?.deliv_n))} sub={t('s_deliv', { p: fmt.pct1(s.deliv) })} hint={t('h_deliv')} />
            <KpiCard
              icon="clock"
              tone="t4"
              label={t('k_delay')}
              value={fmt.int(s.delay_n)}
              isBad={s.delay != null && s.delay > 10}
              delta={delta(s.delay_n, b?.delay_n ?? null, 'rel', 'up')}
              cmp={was(fmt.int(b?.delay_n))}
              sub={t('s_delay', { p: fmt.pct1(s.delay) })}
              hint={t('h_delay')}
            />
            <KpiCard icon="award" tone="t5" label={t('k_ontime')} value={fmt.pct1(s.ontime)} delta={delta(s.ontime, b?.ontime ?? null, 'pt', 'down')} cmp={was(fmt.pct1(b?.ontime))} sub={t('s_ontime')} hint={t('h_ontime')} />
            <KpiCard
              icon="timer"
              tone="t6"
              label={t('k_avg')}
              value={fmt.days(s.mean)}
              delta={delta(s.mean, b?.mean ?? null, 'd', 'up')}
              cmp={was(fmt.days(b?.mean))}
              sub={t('s_avg', { a: fmt.days(s.p50), b: fmt.days(s.p90) })}
              hint={t('h_avg')}
            />
            <KpiCard
              icon="dollar"
              tone="t2"
              label={t('k_risk')}
              value={fmt.usd(s.prob_val)}
              isBad={s.prob_val > 0}
              delta={delta(s.prob_val, b?.prob_val ?? null, 'rel', 'up')}
              cmp={was(fmt.usd(b?.prob_val))}
              sub={t('s_risk', { n: fmt.int(s.prob_n) })}
              hint={t('h_risk')}
            />
          </div>
          <div data-tour="calc">
            <CalcTrace calc={data.calc} />
          </div>

          <div className="grid-2">
            <section className="card glow-host" data-tour="trend">
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
