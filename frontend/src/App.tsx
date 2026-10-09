// App shell: sidebar | header over a workspace of (command bar, filters, section) and the AI Copilot column.
import type { CSSProperties } from 'react'
import { AppProvider } from './app/AppProvider'
import { useApp } from './app/useApp'
import { COPILOT, useLayout } from './app/useLayout'
import { FilterBar } from './components/FilterBar'
import { Header } from './components/Header'
import { Login } from './components/Login'
import { PrintHeader } from './components/PrintHeader'
import { ResizeHandle } from './components/ResizeHandle'
import { Sidebar } from './components/Sidebar'
import { AIExplain } from './features/ai/AIExplain'
import { AISummary } from './features/ai/AISummary'
import { CommandBar } from './features/ai/CommandBar'
import { CopilotPanel } from './features/ai/CopilotPanel'
import { useCopilot } from './features/ai/useCopilot'
import { Builder } from './features/builder/Builder'
import { SavedDashboard } from './features/builder/SavedDashboard'
import { Schedules } from './features/builder/Schedules'
import { Clients } from './features/clients/Clients'
import { Delivery } from './features/delivery/Delivery'
import { Forecast } from './features/forecast/Forecast'
import { Overview } from './features/overview/Overview'
import { Quality } from './features/quality/Quality'
import { Backoffice } from './features/backoffice/Backoffice'
import { Knowledge } from './features/knowledge/Knowledge'
import { Reports } from './features/reports/Reports'
import { Risk } from './features/risk/Risk'
import { useMessages } from './i18n'
import { shell } from './i18n/shell'

function Shell() {
  const { user, section, go, view, dashboardId, openDashboard, dashboardsChanged } = useApp()
  const copilot = useCopilot()
  const layout = useLayout()
  const t = useMessages(shell)
  if (!user) return <Login />

  const content = {
    overview: <Overview />,
    delivery: <Delivery />,
    clients: <Clients />,
    risk: <Risk explain={(o, r) => <AIExplain key={o.order_id} facts={`${r.text} ${r.basis}`} fallback={r.text} />} />,
    forecast: <Forecast />,
    quality: <Quality explain={(_, facts) => <AIExplain facts={facts} />} />,
    reports: <Reports summary={<AISummary key={JSON.stringify(view.f)} />} schedules={<Schedules />} />,
    knowledge: <Knowledge />,
    backoffice: <Backoffice />,
    build: (
      <Builder
        onSaved={(id) => {
          dashboardsChanged()
          openDashboard(id)
        }}
      />
    ),
    saved: dashboardId != null && (
      <SavedDashboard
        key={dashboardId}
        id={dashboardId}
        onChanged={dashboardsChanged}
        onDeleted={() => {
          dashboardsChanged()
          go('build')
        }}
      />
    ),
  }[section]
  const isBuilder = section === 'build' || section === 'saved'
  // Data quality is whole-data; everything else on the dashboard follows the filter bar.
  const hasFilters = !isBuilder && section !== 'quality' && section !== 'knowledge' && section !== 'backoffice'

  return (
    <div className="app" style={{ '--sidebar-w': `${layout.sidebarPx}px`, '--copilot-w': `${layout.copilotW}px` } as CSSProperties}>
      <Sidebar collapsed={layout.collapsed} onToggle={layout.toggleSidebar} />
      <div className="main">
        <Header />
        <div className={`workspace${isBuilder ? ' solo' : ''}`}>
          <main className="content">
            <PrintHeader />
            {!isBuilder && <CommandBar copilot={copilot} />}
            {hasFilters && <FilterBar showCompare={section === 'overview'} />}
            {content}
          </main>
          {!isBuilder && (
            <ResizeHandle value={layout.copilotW} min={COPILOT.min} max={layout.max} label={t('resize_copilot')} onChange={layout.resizeCopilot} onReset={layout.resetCopilot} />
          )}
          {!isBuilder && <CopilotPanel copilot={copilot} />}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
