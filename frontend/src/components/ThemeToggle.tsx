import { useApp } from '../app/useApp'
import { useMessages } from '../i18n'
import { settings } from '../i18n/settings'
import { Icon } from './Icon'

/** Light/Dark switch; the label names the mode it switches to. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useApp()
  const t = useMessages(settings)
  return (
    <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={t(theme === 'dark' ? 'theme_light' : 'theme_dark')}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}
