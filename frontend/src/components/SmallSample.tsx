import { useMessages } from '../i18n'
import { common } from '../i18n/common'

/** Tag for groups under 10 orders. */
export function SmallSample({ n }: { n: number }) {
  const t = useMessages(common)
  return n < 10 ? <span className="tag amber">{t('small_sample')}</span> : null
}
