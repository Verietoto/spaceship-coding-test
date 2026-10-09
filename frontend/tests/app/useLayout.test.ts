import { describe, expect, it } from 'vitest'
import { COPILOT, SIDEBAR, copilotMax } from '../../src/app/useLayout'

describe('copilotMax (how wide the Copilot may be)', () => {
  it('is capped on a wide window', () => {
    expect(copilotMax(SIDEBAR.open, 1920)).toBe(COPILOT.max)
    expect(copilotMax(SIDEBAR.collapsed, 1470)).toBe(COPILOT.max)
  })

  it('leaves the main column at least 400px, so it shrinks with the window', () => {
    // 1100 - 236 (sidebar) - 76 (padding and handle) - 400 (main column) = 388
    expect(copilotMax(SIDEBAR.open, 1100)).toBe(388)
  })

  it('never goes below the Copilot minimum, even on a narrow window', () => {
    expect(copilotMax(SIDEBAR.open, 900)).toBe(COPILOT.min)
  })

  it('gives the Copilot more room when the sidebar is collapsed', () => {
    expect(copilotMax(SIDEBAR.collapsed, 1100)).toBeGreaterThan(copilotMax(SIDEBAR.open, 1100))
  })
})
