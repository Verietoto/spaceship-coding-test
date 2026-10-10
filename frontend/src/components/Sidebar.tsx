// Left column: brand, numbered sections (the active one shows its icon), saved dashboards, "Build with AI" card.
import { useApp } from '../app/useApp'
import { useApi } from '../app/useApi'
import { useMe } from '../app/useMe'
import { useMessages } from '../i18n'
import { common } from '../i18n/common'
import { shell } from '../i18n/shell'
import type { DashboardSection } from '../lib/types'
import { GlowIcon } from './GlowIcon'
import { Icon } from './Icon'

const SECTIONS = ['overview', 'delivery', 'clients', 'risk', 'forecast', 'quality', 'reports'] as const satisfies readonly DashboardSection[]
type DashboardItem = { id: number; title: string; created_at: string }

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { section, go, dashboardId, dashVersion, openDashboard } = useApp()
  const t = useMessages(shell)
  const tc = useMessages(common)
  const { isAdmin } = useMe()
  const { data: dashboards } = useApi<DashboardItem[]>('dashboards', { v: dashVersion })

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span className="brand-text">{t('app_name')}</span>
        </div>
        <button type="button" className="icon-btn sidebar-toggle" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? t('expand') : t('collapse')} title={collapsed ? t('expand') : t('collapse')}>
          <Icon name="chevron" size={16} />
        </button>
      </div>
      <nav aria-label={t('sections')} data-tour="sidebar">
        {SECTIONS.map((s, i) => {
          const isOn = s === section
          return (
            <button key={s} type="button" className="nav-item" data-tour={`nav-${s}`} aria-current={isOn ? 'page' : undefined} onClick={() => go(s)} title={collapsed ? tc(`nav_${s}`) : undefined} aria-label={tc(`nav_${s}`)}>
              {isOn || collapsed ? <Icon name={s} size={20} /> : <span className="nav-num" aria-hidden="true">{i + 1}</span>}
              <span className="nav-text">{tc(`nav_${s}`)}</span>
            </button>
          )
        })}
        {isAdmin && (
          <button type="button" className="nav-item" data-tour="nav-backoffice" aria-current={section === 'backoffice' ? 'page' : undefined} onClick={() => go('backoffice')} title={collapsed ? tc('nav_backoffice') : undefined} aria-label={tc('nav_backoffice')}>
            <Icon name="backoffice" size={20} />
            <span className="nav-text">{tc('nav_backoffice')}</span>
          </button>
        )}
      </nav>
      {Array.isArray(dashboards) && dashboards.length > 0 && (
        <nav className="saved-nav" aria-label={t('saved_dashboards')}>
          <span className="nav-label">{t('saved_dashboards')}</span>
          {dashboards.map((d) => (
            <button
              key={d.id}
              type="button"
              className="nav-item small"
              title={d.title}
              aria-current={section === 'saved' && dashboardId === d.id ? 'page' : undefined}
              onClick={() => openDashboard(d.id)}
            >
              <span className="ai-mini" aria-hidden="true">AI</span>
              <span className="ellipsis">{d.title}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="side-card glow-host" data-tour="build">
        <GlowIcon name="sparkle" tone="ai" size={38} breathe />
        <strong>{t('build_title')}</strong>
        <p>{t('build_desc')}</p>
        <button type="button" className="btn primary block" aria-current={section === 'build' ? 'page' : undefined} onClick={() => go('build')}>
          {t('build_cta')} <Icon name="arrow" size={16} />
        </button>
      </div>
    </aside>
  )
}
