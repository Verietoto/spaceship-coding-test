// Column chart in plain CSS (prototype style): value above each bar, label and optional n= below, dashed grid,
// an optional dashed comparison marker, and forecast columns drawn as a range band plus a point.
// Hovering a column shows its label, value, n and comparison in a tooltip that follows the cursor.
import { useRef, useState } from 'react'

export type BarDatum = {
  label: string
  value: number | null
  valueText?: string
  sub?: string
  tone?: 'warn' | 'good'
  dim?: boolean
  marker?: number | null
  /** The comparison value, worded for the tooltip ("all data 10%"). */
  markerText?: string
  band?: [number, number]
  point?: number
  future?: boolean
}

type Props = { data: BarDatum[]; max: number; step: number; height?: number; axis: (v: number) => string; label: string }

/** What the tooltip says about one column. */
export function BarTip({ d, label }: { d: BarDatum; label: string }) {
  return (
    <>
      <strong>{d.label}</strong>
      <div>{label}: {d.valueText ?? '–'}</div>
      {d.sub && <div>{d.sub}</div>}
      {d.markerText && <div>{d.markerText}</div>}
    </>
  )
}

export function BarChart({ data, max, step, height = 150, axis, label }: Props) {
  const root = useRef<HTMLDivElement>(null)
  // Where the cursor is inside the chart, and which column it is over.
  const [tip, setTip] = useState<{ i: number; x: number; y: number; left: boolean } | null>(null)
  const follow = (i: number, e: React.MouseEvent) => {
    const r = root.current?.getBoundingClientRect()
    if (r) setTip({ i, x: e.clientX - r.left, y: e.clientY - r.top, left: e.clientX - r.left > r.width / 2 }) // left: the tooltip opens to the cursor's left
  }
  const y = (v: number) => (Math.max(0, Math.min(v, max)) / max) * height
  const ticks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v)
  return (
    <div className="bars" role="img" aria-label={label} ref={root}>
      <div className="bars-grid" style={{ height }}>
        {ticks.map((v) => (
          <div key={v} className={v === 0 ? 'base' : ''} style={{ bottom: y(v) }}>
            <span>{axis(v)}</span>
          </div>
        ))}
      </div>
      <div className="bars-cols">
        {data.map((d, i) => (
          <div key={d.label} className="bar-col" onMouseMove={(e) => follow(i, e)} onMouseLeave={() => setTip(null)}>
            <div className="bar-val">{d.valueText ?? ''}</div>
            <div className="bar-track" style={{ height }}>
              {d.value != null && <div className={`bar ${d.tone ?? 'warn'}${d.dim ? ' dim' : ''}`} style={{ height: y(d.value) }} />}
              {d.band && <div className="bar-band" style={{ bottom: y(d.band[0]), height: Math.max(2, y(d.band[1]) - y(d.band[0])) }} />}
              {d.point != null && <div className="bar-point" style={{ bottom: y(d.point) }} />}
              {d.marker != null && <div className="bar-marker" style={{ bottom: y(d.marker) }} />}
            </div>
            <div className={`bar-label${d.future ? ' future' : ''}`}>{d.label}</div>
            {d.sub && <div className="bar-sub">{d.sub}</div>}
          </div>
        ))}
      </div>
      {tip && (
        <div className="bar-tip" role="tooltip" style={{ left: tip.x, top: tip.y, transform: tip.left ? 'translate(calc(-100% - 14px), 14px)' : 'translate(14px, 14px)' }}>
          <BarTip d={data[tip.i]} label={label} />
        </div>
      )}
    </div>
  )
}
