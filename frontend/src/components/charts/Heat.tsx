// A heatmap chart: rows by columns, shaded by value. The same grid as the Delivery page.
import { useMessages } from '../../i18n'
import { chart as chartMsg } from '../../i18n/chart'
import { useFormat } from '../../i18n/format'
import { heat as buildHeat } from '../../lib/chartData'
import type { ChartSpec } from '../../lib/types'
import { Heatmap } from '../Heatmap'

export function Heat({ spec }: { spec: ChartSpec }) {
  const t = useMessages(chartMsg)
  const fmt = useFormat()
  const h = buildHeat(spec.rows, spec.x, spec.series ?? '', spec.y[0])
  return (
    <div className="heat-chart">
      <Heatmap
        rows={h.rows}
        cols={h.cols}
        lo={fmt.value(h.min)}
        hi={fmt.value(h.max)}
        cell={(r, c) => {
          const v = h.cells.get(`${r}|${c}`)
          return v && { share: v.share, text: fmt.value(v.value), title: t('cell', { r, c, v: fmt.value(v.value) }) }
        }}
      />
    </div>
  )
}
