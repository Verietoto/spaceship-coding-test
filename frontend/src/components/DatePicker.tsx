// A calendar popover for one ISO date: month arrows, a scrollable year list (click the title), days outside min/max disabled.
// Built here because the browser's own date picker can't be styled or scrolled consistently.
import { useRef, useState } from 'react'
import { useApp } from '../app/useApp'
import { useMessages } from '../i18n'
import { filters as filtersMsg } from '../i18n/filters'
import { useFormat } from '../i18n/format'
import { LOCALE } from '../i18n'
import { Icon } from './Icon'
import { useDismiss } from './useDismiss'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

type Props = { label: string; value: string | null; min: string; max: string; alignRight?: boolean; onChange: (iso: string) => void }

export function DatePicker({ label, value, min, max, alignRight, onChange }: Props) {
  const { lang } = useApp()
  const t = useMessages(filtersMsg)
  const fmt = useFormat()
  const root = useRef<HTMLDivElement>(null)
  const [isOpen, setOpen] = useState(false)
  const [mode, setMode] = useState<'days' | 'years'>('days')
  const seed = value ?? max
  const [view, setView] = useState({ y: Number(seed.slice(0, 4)), m: Number(seed.slice(5, 7)) - 1 })
  useDismiss(root, isOpen, () => setOpen(false))

  const loc = LOCALE[lang]
  const title = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(view.y, view.m, 1))
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1 + i))) // Monday first
  const lead = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
  const minY = Number(min.slice(0, 4))
  const maxY = Number(max.slice(0, 4))
  const years = Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i)
  const monthKey = (y: number, m: number) => y * 12 + m
  const canPrev = monthKey(view.y, view.m) > monthKey(minY, Number(min.slice(5, 7)) - 1)
  const canNext = monthKey(view.y, view.m) < monthKey(maxY, Number(max.slice(5, 7)) - 1)
  const shift = (n: number) => setView(({ y, m }) => ({ y: y + Math.floor((m + n) / 12), m: (((m + n) % 12) + 12) % 12 }))

  return (
    <div className="popover-wrap date-pick" ref={root}>
      <button type="button" className="sel multi-btn" aria-label={label} aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => { setMode('days'); setOpen(!isOpen) }}>
        <span className="ellipsis">{value ? fmt.date(value) : '—'}</span>
        <Icon name="calendar" size={14} />
      </button>
      {isOpen && (
        <div className={`popover card date-panel${alignRight ? ' right' : ''}`} role="dialog" aria-label={label}>
          <div className="date-head">
            <button type="button" className="icon-btn" aria-label={t('prev_month')} disabled={!canPrev} onClick={() => shift(-1)}>
              <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={14} /></span>
            </button>
            <button type="button" className="link date-title" aria-label={t('choose_year')} aria-expanded={mode === 'years'} onClick={() => setMode(mode === 'days' ? 'years' : 'days')}>
              {title}
            </button>
            <button type="button" className="icon-btn" aria-label={t('next_month')} disabled={!canNext} onClick={() => shift(1)}>
              <span style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Icon name="chevron" size={14} /></span>
            </button>
          </div>
          {mode === 'years' ? (
            <ul className="year-list">
              {years.map((y) => (
                <li key={y}>
                  <button type="button" className="period-opt" aria-pressed={y === view.y} onClick={() => { setView({ y, m: view.m }); setMode('days') }}>{y}</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="date-grid" role="grid">
              {weekdays.map((w) => <span key={w} className="date-wd">{w}</span>)}
              {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
              {Array.from({ length: days }, (_, i) => {
                const d = iso(view.y, view.m, i + 1)
                return (
                  <button key={d} type="button" className="date-day" aria-pressed={d === value} disabled={d < min || d > max} onClick={() => { onChange(d); setOpen(false) }}>
                    {i + 1}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
