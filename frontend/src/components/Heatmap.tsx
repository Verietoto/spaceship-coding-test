// A grid of colored cells: rows by columns, each cell shaded by its place (0..1) on the scale, with a legend. Used by Delivery and by the AI's heatmap charts.
import type { CSSProperties } from 'react'

export type HeatCell = { share: number; text: string; title?: string; thin?: boolean }
type Props = { rows: string[]; cols: string[]; cell: (row: string, col: string) => HeatCell | undefined; lo: string; hi: string }

export function Heatmap({ rows, cols, cell, lo, hi }: Props) {
  return (
    <>
      <div className="heat-grid" style={{ '--cols': cols.length } as CSSProperties}>
        <span />
        {cols.map((c) => <span key={c} className="hdr">{c}</span>)}
        {rows.map((r) => [
          <span key={r} className="rowhdr">{r}</span>,
          ...cols.map((c) => {
            const h = cell(r, c)
            if (!h) return <span key={`${r}|${c}`} className="heat-cell empty" />
            return (
              <span
                key={`${r}|${c}`}
                className={`heat-cell ${h.thin ? 'thin' : ''} ${h.share > 0.55 ? 'dark' : ''}`}
                style={{ background: `color-mix(in oklab, var(--heat-lo), var(--heat-hi) ${h.share * 100}%)` }}
                title={h.title}
              >
                {h.text}
              </span>
            )
          }),
        ])}
      </div>
      <div className="legend-row">
        <span>{lo}</span>
        <span className="heat-scale" />
        <span>{hi}</span>
      </div>
    </>
  )
}
