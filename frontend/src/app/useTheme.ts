// Light/Dark theme: starts from the saved choice or the OS preference, applied as <html data-theme>.
import { useEffect, useState } from 'react'
import { store, stored } from '../lib/storage'

export type Theme = 'light' | 'dark'

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() =>
    stored<Theme>('theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  )
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    store('theme', theme)
  }, [theme])
  return { theme, toggleTheme: () => setTheme((x) => (x === 'dark' ? 'light' : 'dark')) }
}
