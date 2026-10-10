// KPI card: glowing icon tile + label, big value with a colored ↑/↓ change, comparison line, sub line under a rule.
import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { useFormat } from '../i18n/format'
import type { Delta } from '../lib/delta'
import { GlowIcon } from './GlowIcon'
import { Hint } from './Hint'
import type { Tone } from './GlowIcon'
import type { IconName } from './Icon'

type KpiProps = {
  icon: IconName
  tone: Tone
  label: string
  value: string
  isBad?: boolean
  delta?: Delta | null
  /** The value it is compared with, already worded ("previously 1,240"); empty when nothing is compared. */
  cmp?: string
  sub: string
  /** What the metric means, in a sentence: the tooltip of its label. */
  hint: string
}

export function KpiCard({ icon, tone, label, value, isBad, delta, cmp, sub, hint }: KpiProps) {
  const tc = useMessages(common)
  const fmt = useFormat()
  const deltaText =
    delta &&
    `${delta.value >= 0 ? '↑' : '↓'} ${
      delta.kind === 'rel'
        ? fmt.pct0(Math.abs(delta.value))
        : tc(delta.kind === 'pt' ? 'delta_pt' : 'delta_d', { v: fmt.num1(Math.abs(delta.value)) })
    }`
  return (
    <div className="card kpi glow-host">
      <div className="kpi-head">
        <GlowIcon name={icon} tone={tone} />
        <span className="lab"><Hint text={hint}>{label}</Hint></span>
      </div>
      <div className="kpi-value-row">
        <span className={`kpi-value${isBad ? ' bad' : ''}`}>{value}</span>
        {delta && <span className={`delta ${delta.tone}`}>{deltaText}</span>}
      </div>
      <div className="kpi-cmp">{cmp}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  )
}
