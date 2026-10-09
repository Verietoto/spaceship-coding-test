// Localization core. Every UI text lives in i18n/<page-or-component>.ts as
//   key: { id: '…', en: '…' }
// so all languages sit side by side. Leaving a language out is a type error, and adding one to `Lang`
// makes the compiler point at every text still missing it. Components never hold UI text themselves:
//   const t = useMessages(overview);  t('title');  t('orders', { n: 12 })
import { useApp } from '../app/useApp'

export type Lang = 'id' | 'en'
export const LANGS = ['id', 'en'] as const satisfies readonly Lang[]
export const LOCALE: Record<Lang, string> = { id: 'id-ID', en: 'en-US' }

export type Vars = Record<string, string | number>
export type Messages = Record<string, Record<Lang, string>>
export type Translate<M extends Messages> = (key: keyof M & string, vars?: Vars) => string

/** Declares one file's texts; the type check is what guarantees every language is present. */
export const defineMessages = <M extends Messages>(messages: M): M => messages

/** Fills {placeholders} from `vars`. */
export function translate<M extends Messages>(messages: M, lang: Lang): Translate<M> {
  return (key, vars) => {
    let s = messages[key][lang]
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
    return s
  }
}

export function useMessages<M extends Messages>(messages: M): Translate<M> {
  return translate(messages, useApp().lang)
}
