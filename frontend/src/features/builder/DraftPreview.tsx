// A draft (or an AI-proposed change to a saved dashboard) the way it will open: the filters its agent declared, working, and its
// widgets re-rendered by the server with whatever the viewer picks. Nothing is saved. Remount it (a new `key`) for a new draft.
import { useEffect, useState } from 'react'
import { useApp } from '../../app/useApp'
import { DashboardFilters } from '../../components/DashboardFilters'
import { useMessages } from '../../i18n'
import { builder } from '../../i18n/builder'
import { Unauthorized, api } from '../../lib/api'
import { DEFAULT_FILTERS } from '../../lib/types'
import type { Filters } from '../../lib/types'
import { draftSpec } from './useBuilderFlow'
import type { Draft } from './types'
import { Widgets } from './Widgets'
import type { Widget } from './Widgets'

export function DraftPreview({ draft }: { draft: Draft }) {
  const { onUnauthorized } = useApp()
  const t = useMessages(builder)
  const [values, setValues] = useState<Filters | null>(null) // null: the draft's own defaults, which it already carries rendered
  const [shown, setShown] = useState<Widget[] | null>(null)

  useEffect(() => {
    if (values === null) return
    let isStale = false // a slower answer to an earlier pick must not overwrite the latest
    api<{ widgets: Widget[] }>('dashboards/preview', {}, { ...draftSpec(draft, true), values })
      .then((r) => !isStale && setShown(r.widgets))
      .catch((e: unknown) => e instanceof Unauthorized && onUnauthorized())
    return () => {
      isStale = true
    }
  }, [draft, values, onUnauthorized])

  return (
    <>
      {!!draft.filters?.length && (
        <>
          <DashboardFilters
            specs={draft.filters}
            value={values ?? draft.applied ?? DEFAULT_FILTERS}
            onChange={setValues}
            onReset={() => {
              setValues(null)
              setShown(null)
            }}
            isDefault={values === null}
          />
          <p className="muted xsmall">{t('filters_note')}</p>
        </>
      )}
      <Widgets widgets={values === null ? draft.widgets : (shown ?? draft.widgets)} />
    </>
  )
}
