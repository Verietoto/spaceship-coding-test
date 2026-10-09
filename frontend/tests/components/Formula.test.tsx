import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TextFormula } from '../../src/components/Formula'

const html = (text: string) => renderToStaticMarkup(<TextFormula text={text} />)

describe('TextFormula (a formula the AI wrote as text, drawn as maths)', () => {
  it('draws "a ÷ b" as a stacked fraction and keeps the name', () => {
    const out = html('delay rate = delayed orders ÷ all orders')
    expect(out).toContain('<span class="fx-name">delay rate</span>')
    expect(out).toContain('<span class="fx-top">delayed orders</span><span class="fx-bot">all orders</span>')
    expect(out).not.toContain('fx-result') // a definition has no result
  })

  it('puts the last number in the highlighted result and the others in number shapes', () => {
    const out = html('UPS Q1 AOV = 1,010.45 ÷ 35 = $28.87')
    expect(out).toContain('<span class="fx-top"><span class="fx-num">1,010.45</span></span>')
    expect(out).toContain('<span class="fx-bot"><span class="fx-num">35</span></span>')
    expect(out).toContain('<span class="fx-result"><span class="fx-num">$28.87</span></span>')
  })

  it('ignores a closing full stop and keeps Σ in the name', () => {
    expect(html('AOV = total ÷ jumlah order.')).toContain('<span class="fx-bot">jumlah order</span>')
    expect(html('Σ order_value_usd = 4,429.88')).toContain('<span class="fx-name">Σ order_value_usd</span>')
  })

  it('shows a sentence without "=" as plain text', () => {
    expect(html('rate per carrier')).toBe('<div class="fx"><span class="fx-text">rate per carrier</span></div>')
  })

  it('writes × as a dot', () => {
    expect(html('lead = 6 hari × 2 = 12 hari')).toContain('<span class="fx-num">6 hari</span> · <span class="fx-num">2</span>')
  })
})
