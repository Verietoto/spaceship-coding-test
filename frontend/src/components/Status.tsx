import { useMessages } from '../i18n'
import { common } from '../i18n/common'

export function Status({ isLoading, error }: { isLoading?: boolean; error?: string }) {
  const t = useMessages(common)
  if (error) return <p className="note bad" role="alert">{t('error')}: {error}</p>
  if (isLoading) return <p className="muted small">{t('loading')}</p>
  return null
}
