import type { DashFilter, Filters } from '../../lib/types'
import type { Widget } from './Widgets'

/** A dashboard as the Builder drafts it and as a saved one opens: widgets with their rows, and the filters its agent chose. */
export type Draft = { title: string; plan: string[]; widgets: Widget[]; filters?: DashFilter[]; applied?: Filters }
