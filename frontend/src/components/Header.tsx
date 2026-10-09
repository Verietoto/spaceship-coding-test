// Top of the main column: page title + context, then language, theme, account.
import { useApp } from '../app/useApp'
import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { useFormat } from '../i18n/format'
import { shell } from '../i18n/shell'
import { AccountMenu } from './AccountMenu'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
  const { section, view } = useApp()
  const t = useMessages(shell)
  const tc = useMessages(common)
  const fmt = useFormat()
  const isBuilder = section === 'build' || section === 'saved'
  return (
    <header className="header">
      <div className="header-title">
        <strong>{t('title')}</strong>
        <div className="header-meta">
          <span>{isBuilder ? tc('nav_build') : tc(`nav_${section}`)}</span>
          {!isBuilder && section !== 'quality' && <span>{fmt.range(view.f.start, view.f.end)}</span>}
          <span>{t('data_note')}</span>
        </div>
      </div>
      <div className="header-tools">
        <LanguageSwitch />
        <ThemeToggle />
        <AccountMenu />
      </div>
    </header>
  )
}
