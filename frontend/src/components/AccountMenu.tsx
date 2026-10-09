// Account pill (avatar initial + name) opening "Signed in as … / Sign out".
import { useState } from 'react'
import { useApi } from '../app/useApi'
import { useApp } from '../app/useApp'
import { useMessages } from '../i18n'
import { shell } from '../i18n/shell'
import { Icon } from './Icon'

export function AccountMenu() {
  const { user, logout } = useApp()
  const t = useMessages(shell)
  const [isOpen, setOpen] = useState(false)
  const { data: me } = useApi<{ role: 'admin' | 'visitor' }>('me')
  if (!user) return null
  const name = user.split('@')[0] || user
  return (
    <div className="popover-wrap">
      <button type="button" className="account-btn" aria-label={t('account')} aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}>
        <span className="avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        <span className="account-name">{name}</span>
        <Icon name="chevron" size={14} />
      </button>
      {isOpen && (
        <div className="popover narrow card" role="dialog" aria-label={t('account')}>
          <div>
            <div className="lab">{t('signed_in_as')}</div>
            <div className="small" style={{ fontWeight: 700, marginTop: 3, wordBreak: 'break-all' }}>{user}</div>
            {me && <div className="muted xsmall" style={{ marginTop: 2 }}>{t(`role_${me.role}`)}</div>}
          </div>
          <button type="button" className="btn danger" onClick={logout}>
            <Icon name="logout" size={16} /> {t('logout')}
          </button>
        </div>
      )}
    </div>
  )
}
