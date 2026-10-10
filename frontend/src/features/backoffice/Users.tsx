// Backoffice > Users: the accounts, whether each has seen the onboarding tour, and a way to show it to them again (admin only).
import { useState } from 'react'
import { useApi } from '../../app/useApi'
import { useCall } from '../../app/useCall'
import { GlowIcon } from '../../components/GlowIcon'
import { useMessages } from '../../i18n'
import { backoffice } from '../../i18n/backoffice'
import { common } from '../../i18n/common'
import { api } from '../../lib/api'
import { TOUR_VERSION } from '../../lib/tourSteps'

type Account = { id: number; email: string; role: 'admin' | 'visitor'; tour_version: number }

export function Users() {
  const t = useMessages(backoffice)
  const tc = useMessages(common)
  const { version, error, call } = useCall()
  const { data: users } = useApi<Account[]>('admin/users', { v: version })
  const [isAsking, setAsking] = useState(false) // "reset all" asks once more before it does anything

  const status = (v: number) => (v === 0 ? t('tour_none') : t(v < TOUR_VERSION ? 'tour_seen_old' : 'tour_seen', { n: v }))
  const resetAll = async () => {
    setAsking(false)
    await call(() => api('admin/tour/reset', {}, {}))
  }

  return (
    <section className="card glow-host">
      <div className="card-head">
        <div className="card-title">
          <GlowIcon name="clients" tone="t3" />
          <div>
            <h3>{t('users_title')}</h3>
            <p>{t('users_sub')}</p>
          </div>
        </div>
        <div className="card-actions">
          {isAsking ? (
            <>
              <span className="small">{t('reset_all_ask')}</span>
              <button type="button" className="btn danger" onClick={() => void resetAll()}>
                {t('reset_all_yes')}
              </button>
              <button type="button" className="btn ghost" onClick={() => setAsking(false)}>
                {tc('cancel')}
              </button>
            </>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setAsking(true)} disabled={!users?.some((u) => u.tour_version > 0)}>
              {t('reset_all')}
            </button>
          )}
        </div>
      </div>
      {error && <p className="note bad small" role="alert">{error}</p>}
      {users && users.length === 0 && <p className="note">{t('users_none')}</p>}
      {users && users.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('th_email')}</th>
                <th>{t('th_role')}</th>
                <th>{t('th_tour')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{t(u.role === 'admin' ? 'r_admin' : 'r_visitor')}</td>
                  <td>{status(u.tour_version)}</td>
                  <td className="num">
                    <button type="button" className="btn ghost" disabled={u.tour_version === 0} onClick={() => void call(() => api(`admin/users/${u.id}/tour/reset`, {}, {}))}>
                      {t('reset_tour')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
