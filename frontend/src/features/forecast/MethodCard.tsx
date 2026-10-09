// The three methods' backtest errors side by side, the best one marked and the chosen one in bold.
import { Card } from '../../components/Card'
import { useMessages } from '../../i18n'
import { forecast } from '../../i18n/forecast'
import { useFormat } from '../../i18n/format'
import type { ForecastData, Method, MethodName } from './types'

export function MethodCard({ data, selected }: { data: ForecastData; selected: MethodName }) {
  const t = useMessages(forecast)
  const fmt = useFormat()
  const wape = (v: number | null) => fmt.pct0(v == null ? null : v * 100)
  const detail = (m: Method) =>
    m.name === 'moving_average' ? t('p_moving_average', { w: m.params.window ?? 3 })
    : m.name === 'ses' ? t('p_ses', { a: fmt.num2(m.params.alpha ?? 0) })
    : t('p_linear_trend', { s: fmt.num1(m.params.slope ?? 0) })
  return (
    <Card title={t('method_title')} className="glow-host">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('col_method')}</th>
              <th className="num">{t('col_wape')}</th>
              <th className="num">{t('col_mae')}</th>
            </tr>
          </thead>
          <tbody>
            {data.methods.map((m) => (
              <tr key={m.name} aria-current={m.name === selected ? 'true' : undefined} style={m.name === selected ? { fontWeight: 700 } : undefined}>
                <td>
                  {t(`n_${m.name}`)} <span className="muted xsmall">({detail(m)}){m.name === data.method && ` · ${t('best')}`}</span>
                </td>
                <td className="num">{wape(m.wape)}</td>
                <td className="num">{fmt.num1(m.mae)}</td>
              </tr>
            ))}
            <tr className="muted">
              <td>{t('m_naive')}</td>
              <td className="num">{wape(data.naive.wape)}</td>
              <td className="num">{fmt.num1(data.naive.mae)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}
