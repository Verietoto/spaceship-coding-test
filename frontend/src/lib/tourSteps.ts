// The tour's steps, in order (plain data, so the Backoffice can also tell whether an account has seen the latest version).
// Add a step with a higher `since` and accounts that finished the tour before see only that one, under "What's new".
import { latestVersion } from './tour'
import type { StepDef } from './tour'

export const STEPS: readonly StepDef[] = [
  // getting around
  { id: 'sidebar', chapter: 'layout', target: 'sidebar', since: 1 },
  { id: 'header', chapter: 'layout', target: 'header-tools', since: 1 },
  // one step per section of the sidebar (the admin's Backoffice has its own step at the end)
  { id: 'sec_overview', chapter: 'sections', target: 'nav-overview', since: 2 },
  { id: 'sec_delivery', chapter: 'sections', target: 'nav-delivery', since: 2 },
  { id: 'sec_clients', chapter: 'sections', target: 'nav-clients', since: 2 },
  { id: 'sec_risk', chapter: 'sections', target: 'nav-risk', since: 2 },
  { id: 'sec_forecast', chapter: 'sections', target: 'nav-forecast', since: 2 },
  { id: 'sec_quality', chapter: 'sections', target: 'nav-quality', since: 2 },
  { id: 'reports', chapter: 'sections', target: 'nav-reports', since: 1 },
  // reading the data
  { id: 'filters', chapter: 'data', target: 'filters', since: 1 },
  { id: 'compare', chapter: 'data', target: 'compare', since: 1 },
  { id: 'kpis', chapter: 'data', target: 'kpis', since: 1 },
  { id: 'calc', chapter: 'data', target: 'calc', since: 1 },
  // a worked case: H2 against H1 (the tour puts the example on screen, then puts the account's own view back)
  { id: 'case_setup', chapter: 'case', target: 'filters', since: 2, demo: 'compare' },
  { id: 'case_read', chapter: 'case', target: 'kpis', since: 2, demo: 'compare', items: 3 },
  { id: 'case_trend', chapter: 'case', target: 'trend', since: 2, demo: 'compare' },
  // working with the AI
  { id: 'ask', chapter: 'ai', target: 'ask', since: 1 },
  { id: 'ask_howto', chapter: 'ai', target: 'ask', since: 2, items: 4 },
  { id: 'copilot', chapter: 'ai', target: 'copilot', since: 1 },
  // building a dashboard (the last two steps are on the Build page)
  { id: 'build', chapter: 'build', target: 'build', since: 1 },
  { id: 'build_prompt', chapter: 'build', target: 'build-prompt', since: 2, section: 'build', items: 4 },
  { id: 'build_example', chapter: 'build', target: 'build-example', since: 2, section: 'build' },
  // admin
  { id: 'backoffice', chapter: 'admin', target: 'nav-backoffice', since: 1, admin: true },
]

/** The version an account is on once it has finished everything in STEPS. */
export const TOUR_VERSION = latestVersion(STEPS)
