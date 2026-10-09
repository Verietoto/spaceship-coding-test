// A small, safe markdown renderer for what the AI writes: paragraphs, lists (one nested level), **bold**, *italic*, `code`,
// links, small headings, tables, code blocks and rules. It builds React elements (never HTML strings), so nothing the model
// writes can inject markup. Links open in a new tab, and only http(s) and mailto addresses become links (never javascript:).
import type { ReactNode } from 'react'

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s<>]+|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g

/** The address if it is safe to open from AI text, else null. */
function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}
const anchor = (key: string, href: string, label: string) => <a key={key} href={href} target="_blank" rel="noopener noreferrer">{label}</a>

/** `scope` keeps keys unique when several lines end up in one array (a paragraph is one array of all its lines). */
function inline(text: string, scope = ''): ReactNode[] {
  return text.split(INLINE).map((part, n) => {
    const i = `${scope}${n}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>
    if (part.length > 2 && ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_')))) return <em key={i}>{part.slice(1, -1)}</em>
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
    if (link) {
      const href = safeHref(link[2])
      return href ? anchor(i, href, link[1]) : link[1]
    }
    if (/^https?:\/\//.test(part)) {
      const url = part.replace(/[.,;:!?)\]]+$/, '') // a trailing full stop or bracket belongs to the sentence, not the address
      const href = safeHref(url)
      return href ? [anchor(i, href, url), part.slice(url.length)] : part
    }
    return part
  })
}

type Item = { depth: number; ordered: boolean; text: string }
const LIST = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/
const ROW = /^\s*\|.*\|\s*$/
const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

function list(items: Item[], key: number): ReactNode {
  const Tag = items[0].ordered ? 'ol' : 'ul'
  const out: ReactNode[] = []
  for (let i = 0; i < items.length; i++) {
    const head = items[i]
    const nested: Item[] = []
    while ((items[i + 1]?.depth ?? 0) > head.depth) nested.push({ ...items[++i], depth: head.depth })
    out.push(
      <li key={out.length}>
        {inline(head.text)}
        {nested.length > 0 && list(nested, out.length)}
      </li>,
    )
  }
  return <Tag key={key}>{out}</Tag>
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{para.flatMap((l, i) => (i ? [<br key={`b${i}`} />, ...inline(l, `l${i}-`)] : inline(l, 'l0-')))}</p>)
    para = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) {
      flush()
    } else if (line.trim().startsWith('```')) {
      flush()
      const code: string[] = []
      while (++i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i])
      blocks.push(<pre key={blocks.length}><code>{code.join('\n')}</code></pre>)
    } else if (/^\s*#{1,3}\s+/.test(line)) {
      flush()
      blocks.push(<h4 key={blocks.length} className="md-h">{inline(line.replace(/^\s*#{1,3}\s+/, ''))}</h4>)
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush()
      blocks.push(<hr key={blocks.length} />)
    } else if (ROW.test(line) && lines[i + 1] && SEPARATOR.test(lines[i + 1])) {
      flush()
      const head = cells(line)
      const rows: string[][] = []
      for (i += 2; i < lines.length && ROW.test(lines[i]); i++) rows.push(cells(lines[i]))
      i--
      blocks.push(
        <div key={blocks.length} className="md-table">
          <table>
            <thead><tr>{head.map((c, j) => <th key={j} scope="col">{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
    } else if (LIST.test(line)) {
      flush()
      const items: Item[] = []
      for (; i < lines.length; i++) {
        const m = LIST.exec(lines[i])
        if (m) items.push({ depth: m[1].length >= 2 ? 1 : 0, ordered: /\d/.test(m[2]), text: m[3] })
        else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) items[items.length - 1].text += ` ${lines[i].trim()}`
        else break
      }
      i--
      blocks.push(list(items, blocks.length))
    } else {
      para.push(line.trim())
    }
  }
  flush()
  return <div className="md">{blocks}</div>
}
