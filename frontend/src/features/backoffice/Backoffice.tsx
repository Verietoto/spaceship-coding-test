// Backoffice (admin only): the team's documents and the AI settings. The server refuses anyone else; the sidebar hides it.
import { useState } from 'react'
import { SectionHead } from '../../components/SectionHead'
import { Seg } from '../../components/Seg'
import { useMessages } from '../../i18n'
import { backoffice } from '../../i18n/backoffice'
import { common } from '../../i18n/common'
import { AiSettings } from './AiSettings'
import { Documents } from './Documents'

export function Backoffice() {
  const t = useMessages(backoffice)
  const tc = useMessages(common)
  const [tab, setTab] = useState<'docs' | 'ai'>('docs')
  return (
    <>
      <SectionHead title={tc('nav_backoffice')} question={t('question')} />
      <Seg label={t('tabs')} value={tab} onChange={setTab} options={[['docs', t('tab_docs')], ['ai', t('tab_ai')]]} />
      {tab === 'docs' ? <Documents /> : <AiSettings />}
    </>
  )
}
