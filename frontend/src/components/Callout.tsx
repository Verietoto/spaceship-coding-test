import type { ReactNode } from 'react'
import { Icon } from './Icon'

/** Note under a chart: neutral info (indigo tint) or a positive reading (green). */
export function Callout({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'warn'; children: ReactNode }) {
  return (
    <div className={`callout ${tone === 'info' ? '' : tone}`}>
      <Icon name={tone === 'ok' ? 'check' : 'info'} size={16} />
      <span>{children}</span>
    </div>
  )
}
