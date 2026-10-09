import { useState } from 'react'

// Shown only when printing / saving as PDF: what this page is, which filters it used, and when it was printed.
import { useApp } from '../app/useApp'
import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { filters as filtersMsg } from '../i18n/filters'
import { useFilterLines } from './useFilterLines'

export function PrintHeader() {
  const { section, view } = useApp()
  const t = useMessages(filtersMsg)
  const tc = useMessages(common)
  const filterLines = useFilterLines()
  const [printedAt] = useState(() => new Date().toLocaleString())
  const name = section === 'build' || section === 'saved' ? tc('nav_build') : tc(`nav_${section}`)
  return (
    <header className="print-only">
      <h1>{t('print_title', { s: name })}</h1>
      <p>{filterLines(view.f).join(' · ')}</p>
      <p className="muted">{t('print_date', { d: printedAt })}</p>
    </header>
  )
}
