// A: the command bar above the filters.
import { useMessages } from '../../i18n'
import { copilot as copilotMsg } from '../../i18n/copilot'
import { AskForm } from './AskForm'
import type { Copilot } from './useCopilot'

export function CommandBar({ copilot }: { copilot: Copilot }) {
  const t = useMessages(copilotMsg)
  return <AskForm copilot={copilot} placeholder={t('placeholder')} />
}
