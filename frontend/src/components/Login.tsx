import { useState } from 'react'
import type { FormEvent } from 'react'
import { useApp } from '../app/useApp'
import { useMessages } from '../i18n'
import { login as loginMsg } from '../i18n/login'
import { ApiError, api } from '../lib/api'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeToggle } from './ThemeToggle'

export function Login() {
  const { login } = useApp()
  const t = useMessages(loginMsg)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<'wrong' | 'tooMany' | null>(null)
  const [isShown, setShown] = useState(false)
  const [isBusy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('login', {}, { email, password })
      login(email)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'tooMany' : 'wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <div className="login-tools">
        <LanguageSwitch />
        <ThemeToggle />
      </div>
      <form className="card login-card" onSubmit={handleSubmit}>
        <span className="brand-mark" aria-hidden="true">S</span>
        <div>
          <h1>{t('title')}</h1>
          <p className="muted small" style={{ marginTop: 4 }}>{t('sub')}</p>
        </div>
        <label className="field">
          {t('email')}
          <input type="email" required autoComplete="email" placeholder={t('email_ph')} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          {t('password')}
          <span className="pw-wrap">
            <input type={isShown ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="pw-toggle" aria-pressed={isShown} onClick={() => setShown((v) => !v)}>{t(isShown ? 'hide' : 'show')}</button>
          </span>
        </label>
        {error && <p className="note bad" role="alert">{t(error)}</p>}
        <button type="submit" className="btn primary lg block" disabled={isBusy}>{t('submit')}</button>
        <div className="divider">{t('or')}</div>
        <button type="button" className="btn lg block" disabled>{t('sso')}</button>
        <p className="muted xsmall" style={{ textAlign: 'center' }}>{t('demo')}</p>
      </form>
    </main>
  )
}
