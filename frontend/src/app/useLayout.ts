// The layout the user can adjust: whether the sidebar is collapsed, and how wide the Copilot panel is. Both are remembered.
import { useEffect, useState } from 'react'
import { store, stored } from '../lib/storage'

export const SIDEBAR = { open: 236, collapsed: 68 }
export const COPILOT = { min: 300, def: 360, max: 640 }
const CONTENT_MIN = 400 // the main column never gets narrower than this
const CHROME = 76 // workspace side padding (56) + the resize handle column (20)

/** The widest the Copilot may be: capped, and always leaving the main column its minimum. Mirrors the CSS clamp(). */
export const copilotMax = (sidebarPx: number, viewport = window.innerWidth) => Math.min(COPILOT.max, Math.max(COPILOT.min, viewport - sidebarPx - CHROME - CONTENT_MIN))

export function useLayout() {
  const [collapsed, setCollapsed] = useState(() => stored<string>('sidebar', '') === 'collapsed')
  const [copilotW, setCopilotW] = useState(() => Math.min(COPILOT.max, Math.max(COPILOT.min, Number(stored('copilot_w', '')) || COPILOT.def)))
  const [viewport, setViewport] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const sidebarPx = collapsed ? SIDEBAR.collapsed : SIDEBAR.open

  return {
    collapsed,
    sidebarPx,
    copilotW,
    max: copilotMax(sidebarPx, viewport),
    toggleSidebar: () => {
      store('sidebar', collapsed ? '' : 'collapsed')
      setCollapsed(!collapsed)
    },
    /** While dragging `final` is false (just the state); on release it is remembered too. */
    resizeCopilot: (w: number, final = false) => {
      const next = Math.round(Math.min(copilotMax(sidebarPx), Math.max(COPILOT.min, w)))
      setCopilotW(next)
      if (final) store('copilot_w', String(next))
    },
    resetCopilot: () => {
      setCopilotW(COPILOT.def)
      store('copilot_w', String(COPILOT.def))
    },
  }
}
