// An icon on a soft colored tile with a glow (see `.glow` in styles/index.css). Decorative: the label next to it carries meaning.
import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export type Tone = 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 'ai' | 'good' | 'bad' | 'warn'

export function GlowIcon({ name, tone = 't1', size = 40, breathe = false }: { name: IconName; tone?: Tone; size?: number; breathe?: boolean }) {
  return (
    <span className={`glow ${tone}${breathe ? ' breathe' : ''}`} style={{ '--s': `${size}px` } as CSSProperties} aria-hidden="true">
      <Icon name={name} size={Math.round(size * 0.5)} />
    </span>
  )
}
