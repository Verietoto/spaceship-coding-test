import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../../src/components/Markdown'

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />)

/** Every key among siblings must be unique: React warns, and can drop or duplicate children on update, when they are not. */
function duplicateKeys(node: ReactNode): string[] {
  const found: string[] = []
  const walk = (n: ReactNode) => {
    if (Array.isArray(n)) {
      const keys = n.filter(isValidElement).map((c) => c.key).filter((k): k is string => k !== null)
      found.push(...keys.filter((k, i) => keys.indexOf(k) !== i))
      n.forEach(walk)
    } else if (isValidElement<{ children?: ReactNode }>(n)) {
      walk(n.props.children)
    }
  }
  walk(node)
  return found
}

describe('Markdown', () => {
  it('draws bold, italic, code, bullets (one nested level) and numbered lists', () => {
    expect(html('Hasil **tebal**, *miring*, `kode`')).toBe('<div class="md"><p>Hasil <strong>tebal</strong>, <em>miring</em>, <code>kode</code></p></div>')
    expect(html('- a\n  - a1\n- b')).toBe('<div class="md"><ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul></div>')
    expect(html('1. satu\n2. dua')).toBe('<div class="md"><ol><li>satu</li><li>dua</li></ol></div>')
  })

  it('draws a table with column headers, and a code block as written', () => {
    const table = html('| Carrier | Delay |\n|---|---|\n| UPS | **19%** |')
    expect(table).toContain('<th scope="col">Carrier</th>')
    expect(table).toContain('<td><strong>19%</strong></td>')
    expect(html('```\nSELECT 1\n```')).toContain('<pre><code>SELECT 1</code></pre>')
  })

  it('keeps line breaks inside a paragraph', () => {
    expect(html('satu\ndua')).toContain('<p>satu<br/>dua</p>')
  })

  it('has unique keys when several lines of one paragraph use the same markup', () => {
    expect(duplicateKeys(Markdown({ text: 'baris **satu** dan `kode`\nbaris **dua** dan `kode` lagi\nbaris **tiga**' }))).toEqual([])
    expect(duplicateKeys(Markdown({ text: '- **a** `b`\n- **c** `d`' }))).toEqual([])
  })

  it('turns links into anchors that open in a new tab, leaving the sentence punctuation out', () => {
    const link = html('Lihat [LinkedIn](https://www.linkedin.com/in/x/) ya')
    expect(link).toContain('<a href="https://www.linkedin.com/in/x/" target="_blank" rel="noopener noreferrer">LinkedIn</a>')
    const bare = html('Profil: https://example.com/a_b_c.')
    expect(bare).toContain('<a href="https://example.com/a_b_c" target="_blank" rel="noopener noreferrer">https://example.com/a_b_c</a>.')
    expect(html('[tulis](mailto:a@b.co)')).toContain('href="mailto:a@b.co"')
  })

  it('never makes a link of a dangerous scheme, and shows injected HTML as text', () => {
    expect(html('[klik](javascript:alert(1))')).not.toContain('<a')
    expect(html('[x](data:text/html;base64,AAAA)')).not.toContain('<a')
    const injected = html('<script>alert(1)</script> <img src=x onerror=alert(1)>')
    expect(injected).not.toContain('<script')
    expect(injected).not.toContain('<img')
    expect(injected).toContain('&lt;script&gt;')
  })
})
