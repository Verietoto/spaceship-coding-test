// Knowledge: what the copilot knows about you (private notes). The team's documents are managed in the backoffice.
import { SectionHead } from '../../components/SectionHead'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { knowledge } from '../../i18n/knowledge'
import { AboutMe } from './AboutMe'

export function Knowledge() {
  const t = useMessages(knowledge)
  const tc = useMessages(common)
  return (
    <>
      <SectionHead title={tc('nav_knowledge')} question={t('question')} />
      <AboutMe />
    </>
  )
}
