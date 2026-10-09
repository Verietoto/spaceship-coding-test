// Inventory recommendation for a units forecast: forecast demand, the safety stock on top, and the total. The formula and what
// it assumes are one hover away on the title.
import { Card } from '../../components/Card'
import { Hint } from '../../components/Hint'
import { useMessages } from '../../i18n'
import { forecast } from '../../i18n/forecast'
import { useFormat } from '../../i18n/format'
import type { Inventory } from './types'

export function InventoryCard({ inv }: { inv: Inventory }) {
  const t = useMessages(forecast)
  const fmt = useFormat()
  const units = (v: number) => t('inv_unit', { v: fmt.num0(v) })
  const about = `${t('inv_formula', { z: fmt.num2(inv.z), s: Math.round(inv.service * 100) })}. ${t('inv_note', { n: inv.months })}`
  return (
    <Card title={<Hint text={about}>{t('inv_title')}</Hint>} className="glow-host">
      <div className="stat-row">
        <div>
          <div className="lab">{t('inv_planned', { n: inv.months })}</div>
          <div className="big">{units(inv.planned)}</div>
        </div>
        <div>
          <div className="lab">{t('inv_safety')}</div>
          <div className="big">{units(inv.safety)}</div>
        </div>
        <div>
          <div className="lab">{t('inv_total')}</div>
          <div className="big">{t('inv_unit', { v: fmt.int(inv.total) })}</div>
        </div>
      </div>
    </Card>
  )
}
