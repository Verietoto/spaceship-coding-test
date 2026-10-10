import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BarChart, BarTip } from '../../src/components/BarChart'

const tip = (d: Parameters<typeof BarTip>[0]['d']) => renderToStaticMarkup(<BarTip d={d} label="Delay rate" />)

describe('BarTip (the tooltip of one column)', () => {
  it('says the label, value, n and comparison', () => {
    expect(tip({ label: 'Mar', value: 12, valueText: '12%', sub: 'n=88', markerText: 'all data 10%' })).toBe(
      '<strong>Mar</strong><div>Delay rate: 12%</div><div>n=88</div><div>all data 10%</div>',
    )
  })
  it('shows a dash for a column without data and no empty lines', () => {
    expect(tip({ label: 'Apr', value: null })).toBe('<strong>Apr</strong><div>Delay rate: –</div>')
  })
})

describe('BarChart', () => {
  it('shows no tooltip until the cursor is over a column', () => {
    const html = renderToStaticMarkup(
      <BarChart label="Delay rate" max={20} step={10} axis={(v) => `${v}%`} data={[{ label: 'Mar', value: 12, valueText: '12%' }]} />,
    )
    expect(html).not.toContain('role="tooltip"')
    expect(html).toContain('12%') // the value above the bar stays
  })
})
