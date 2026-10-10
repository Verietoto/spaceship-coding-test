// Formulas drawn like maths instead of printed as sentences: a stacked fraction with a bar, a big Σ, the numbers picked out,
// and the result in a highlighted shape. `MetricFormula` draws the dashboard's own metrics from their numbers (calc.terms);
// `TextFormula` does the same for a formula the AI wrote as text ("a ÷ b = c"). No library, just markup and CSS.
import type { ReactNode } from 'react'
import { useMessages } from '../i18n'
import { useFormat } from '../i18n/format'
import { formulas as formulaMsg, isFormulaKey } from '../i18n/formulas'

const Eq = () => <span className="fx-eq">=</span>
const Num = ({ children }: { children: ReactNode }) => <span className="fx-num">{children}</span>
const Cap = ({ children }: { children: ReactNode }) => <span className="fx-cap">{children}</span>
const Result = ({ children }: { children: ReactNode }) => <span className="fx-result">{children}</span>
const Sigma = () => <span className="fx-sigma">Σ</span>
function Frac({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <span className="fx-frac">
      <span className="fx-top">{top}</span>
      <span className="fx-bot">{bottom}</span>
    </span>
  )
}
const Row = ({ name, children }: { name: ReactNode; children: ReactNode }) => (
  <div className="fx">
    <span className="fx-name">{name}</span>
    <Eq />
    {children}
  </div>
)

const NUMBER = /(\$?\d[\d.,]*(?:%|\s?(?:d|hari|days?))?)/g
/** Numbers stand out and a Σ is drawn big; everything else stays as written. */
function marked(text: string): ReactNode[] {
  return text.split(NUMBER).flatMap((part, i) => {
    if (i % 2) return [<Num key={i}>{part}</Num>]
    return part.split('Σ').flatMap((p, j) => (j ? [<Sigma key={`${i}s${j}`} />, p] : [p]))
  })
}

/** "delay rate = delayed ÷ all orders = 19.3%": a name, then each side of "=", a "÷" becomes a fraction, the last number the result. */
export function TextFormula({ text }: { text: string }) {
  const sides = text.replace(/\.$/, '').split(/\s=\s/)
  const side = (s: string, last: boolean) => {
    const halves = s.split(/\s÷\s/)
    if (halves.length === 2) return <Frac top={marked(halves[0])} bottom={marked(halves[1])} />
    return last && /\d/.test(s) ? <Result>{marked(s)}</Result> : <span className="fx-text">{marked(s.replace(/\s×\s/g, ' · '))}</span>
  }
  if (sides.length < 2) return <div className="fx"><span className="fx-text">{marked(text)}</span></div>
  return (
    <div className="fx">
      <span className="fx-name">{sides[0]}</span>
      {sides.slice(1).map((s, i) => (
        <span key={i} className="fx-step">
          <Eq />
          {side(s, i === sides.length - 2)}
        </span>
      ))}
    </div>
  )
}

type Terms = Record<string, number | null>

/** One of the dashboard's metrics drawn from its numbers; without numbers (e.g. KPIs per group) its definition, as maths too. */
export function MetricFormula({ metric, terms }: { metric: string; terms?: Terms }) {
  const t = useMessages(formulaMsg)
  const fmt = useFormat()
  if (!terms) return <TextFormula text={isFormulaKey(metric) ? t(metric) : metric} />
  const int = (k: string) => fmt.int(terms[k])
  const pct = fmt.pct1(terms.value)
  const rate = (name: string, upper: string, lower: string) => (
    <Row name={name}>
      <Frac top={<><Num>{int('num')}</Num> <Cap>{upper}</Cap></>} bottom={<><Num>{int('den')}</Num> <Cap>{lower}</Cap></>} />
      <Eq />
      <Result>{pct}</Result>
    </Row>
  )
  switch (metric) {
    case 'orders':
      return <Row name={t('l_orders')}><Num>{int('n')}</Num><Cap>{t('c_rows')}</Cap></Row>
    case 'value':
      return (
        <>
          <Row name={t('l_value')}><Sigma /><span className="fx-text">order_value_usd</span><Cap>{int('n')} {t('c_orders')}</Cap><Eq /><Result>{fmt.usd2(terms.sum)}</Result></Row>
          <Row name={t('l_aov')}><Frac top={<Num>{fmt.usd2(terms.sum)}</Num>} bottom={<Num>{int('n')}</Num>} /><Eq /><Result>{fmt.usd2(terms.aov)}</Result></Row>
        </>
      )
    case 'delivered':
      return rate(t('l_delivered'), t('c_delivered'), t('c_orders'))
    case 'delay':
      return rate(t('l_delay'), t('c_delayed'), t('c_orders'))
    case 'ontime':
      return rate(t('l_ontime'), t('c_delivered'), t('c_final'))
    case 'mean':
      return (
        <Row name={t('l_mean')}>
          <Cap>{int('n')} {t('c_arrived')}</Cap>
          <Eq />
          <Result>{fmt.days(terms.value)}</Result>
          <span className="fx-sub">{t('c_median')} <Num>{fmt.days(terms.median)}</Num> · P90 <Num>{fmt.days(terms.p90)}</Num></span>
        </Row>
      )
    case 'over7':
      return rate(t('l_over7'), t('c_over7'), t('c_arrived'))
    case 'p90':
      return (
        <Row name={t('l_p90')}>
          <span className="fx-text">{t('c_pctl')}</span>
          <Cap>{int('n')} {t('c_arrived')}</Cap>
          <Eq />
          <Result>{fmt.days(terms.value)}</Result>
          <span className="fx-sub">{t('c_median')} <Num>{fmt.days(terms.median)}</Num> · {t('c_mean')} <Num>{fmt.days(terms.mean)}</Num></span>
        </Row>
      )
    case 'stuck':
      return <Row name={t('l_stuck')}><Result>{int('n')}</Result><Cap>{t('c_stuck')}</Cap></Row>
    case 'exc':
      return <Row name={t('l_exc')}><Result>{int('n')}</Result><Cap>{t('c_exc')}</Cap></Row>
    case 'atrisk':
      return <Row name={t('l_atrisk')}><Sigma /><span className="fx-text">order_value_usd</span><Cap>{int('n')} {t('c_problem')}</Cap><Eq /><Result>{fmt.usd2(terms.sum)}</Result></Row>
    default:
      return <TextFormula text={metric} />
  }
}
