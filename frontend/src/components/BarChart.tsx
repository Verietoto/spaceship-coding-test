// Column chart in plain CSS (prototype style): value above each bar, label and optional n= below, dashed grid,
// an optional dashed comparison marker, and forecast columns drawn as a range band plus a point.
export type BarDatum = {
  label: string
  value: number | null
  valueText?: string
  sub?: string
  tone?: 'warn' | 'good'
  dim?: boolean
  marker?: number | null
  band?: [number, number]
  point?: number
  future?: boolean
}

type Props = { data: BarDatum[]; max: number; step: number; height?: number; axis: (v: number) => string; label: string }

export function BarChart({ data, max, step, height = 150, axis, label }: Props) {
  const y = (v: number) => (Math.max(0, Math.min(v, max)) / max) * height
  const ticks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v)
  return (
    <div className="bars" role="img" aria-label={label}>
      <div className="bars-grid" style={{ height }}>
        {ticks.map((v) => (
          <div key={v} className={v === 0 ? 'base' : ''} style={{ bottom: y(v) }}>
            <span>{axis(v)}</span>
          </div>
        ))}
      </div>
      <div className="bars-cols">
        {data.map((d) => (
          <div key={d.label} className="bar-col">
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
    </div>
  )
}
