// 6. Data quality: what limits trust in the numbers (whole data, not filtered).
import type { ReactNode } from 'react'
import { useApi } from '../../app/useApi'
import { useApp } from '../../app/useApp'
import { GlowIcon } from '../../components/GlowIcon'
import type { Tone } from '../../components/GlowIcon'
import type { IconName } from '../../components/Icon'
import { SectionHead } from '../../components/SectionHead'
import { Status } from '../../components/Status'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { useFormat } from '../../i18n/format'
import { quality } from '../../i18n/quality'

type QualityData = {
  stuck: number
  in_transit: number
  stuck_clients: number
  stuck_value: number
  promo: number
  promo_value: number
  promo_discount: number
  total_value: number
}

type QualityProps = { explain?: (issue: 1 | 2 | 3, facts: string) => ReactNode }

export function Quality({ explain }: QualityProps) {
  const { go } = useApp()
  const t = useMessages(quality)
  const tc = useMessages(common)
  const fmt = useFormat()
  const { data, error, isLoading } = useApi<QualityData>('quality')
  if (!data) return <Status isLoading={isLoading} error={error} />
  const issues: { id: 1 | 2 | 3; n: number; color: string; icon: IconName; tone: Tone; title: string; text: string }[] = [
    {
      id: 1,
      n: data.stuck,
      color: 'var(--bad)',
      icon: 'risk',
      tone: 't4',
      title: t('dq1_title', { n: data.stuck }),
      text: t('dq1_text', { t: data.in_transit, n: data.stuck, c: data.stuck_clients, v: fmt.usd(data.stuck_value) }),
    },
    { id: 2, n: data.promo, color: 'var(--amber)', icon: 'dollar', tone: 't6', title: t('dq2_title', { n: data.promo }), text: t('dq2_text', { v: fmt.usd(data.promo_value), d: fmt.usd(data.promo_discount) }) },
    { id: 3, n: 0, color: 'var(--mute)', icon: 'clock', tone: 't3', title: t('dq3_title'), text: t('dq3_text') },
  ]
  return (
    <>
      <SectionHead title={tc('nav_quality')} question={t('question')} />
      <div className="stat-grid">
        {issues.map((i) => (
          <section key={i.id} className="card quality-card glow-host">
            <div className="kpi-head">
              <GlowIcon name={i.icon} tone={i.tone} />
              <span className="big-num" style={{ color: i.color }}>{fmt.int(i.n)}</span>
            </div>
            <h3>{i.title}</h3>
            <p>{i.text}</p>
            {i.id === 1 && (
              <button type="button" className="btn primary" style={{ justifySelf: 'start' }} onClick={() => go('risk')}>
                {t('go_risk')}
              </button>
            )}
            {explain?.(i.id, `${i.title}. ${i.text}`)}
          </section>
        ))}
      </div>
    </>
  )
}
