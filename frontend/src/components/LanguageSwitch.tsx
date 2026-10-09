import { useApp } from '../app/useApp'
import { LANGS, useMessages } from '../i18n'
import { settings } from '../i18n/settings'
import { Seg } from './Seg'

export function LanguageSwitch() {
  const { lang, setLang } = useApp()
  const t = useMessages(settings)
  return <Seg label={t('language')} value={lang} options={LANGS.map((l) => [l, t(`lang_${l}`)])} onChange={setLang} />
}
