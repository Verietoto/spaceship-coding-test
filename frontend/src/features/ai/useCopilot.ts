// Copilot conversation state, shared by the command bar and the panel. Reads the backend's progress stream (which agent
// was deployed, which tool ran) while the answer is being worked out, then applies the AI's filter/section changes.
import { useRef, useState } from 'react'
import { useApp } from '../../app/useApp'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { reduceSteps, finishSteps } from '../../lib/agentSteps'
import type { AgentEvent, Step } from '../../lib/agentSteps'
import { Unauthorized, errorText, streamEvents } from '../../lib/api'
import type { Calc, ChartSpec, Compare, Dimension, Filters, Section } from '../../lib/types'

export type Change = { key: Dimension | 'start' | 'end' | 'exclude' | 'ranges' | 'arrived_start' | 'arrived_end' | 'compare'; from: unknown; to: unknown }
type Verdict = { action: 'allow' | 'warn' | 'block' | 'skipped' }
type CopilotResponse = {
  answer: string
  changes: Change[]
  filters: Filters
  compare: Compare
  section: Section | null
  chart: ChartSpec | null
  calc: Calc | null
  remembered?: { id: number; text: string }[]
  guard?: { input?: Verdict; tools?: Verdict[] } | null
}

type StreamEvent = AgentEvent | { type: 'done'; response: CopilotResponse } | { type: 'error'; status: number; message: string }

export type Msg = {
  role: 'user' | 'assistant'
  text: string
  remembered?: string[]
  guard?: 'ok' | 'flagged'
  changes?: Change[]
  chart?: ChartSpec | null
  calc?: Calc | null
  isError?: boolean
  steps?: Step[]
  seconds?: number
}

/** "flagged" only when a guardrail blocked something (the answer or a query was limited); a mere "unsure" (warn) is stored for the admin, not shown. Nothing when they did not run (no Jev key). */
function guardStatus(g: CopilotResponse['guard']): Msg['guard'] {
  if (!g || g.input?.action === 'skipped') return undefined
  const all = [g.input, ...(g.tools ?? [])]
  return all.some((v) => v?.action === 'block') ? 'flagged' : 'ok'
}
export type Copilot = ReturnType<typeof useCopilot>

export function useCopilot() {
  const app = useApp()
  const tc = useMessages(common)
  const [messages, setMessages] = useState<Msg[]>([])
  const [isBusy, setBusy] = useState(false)
  const [live, setLive] = useState<Step[]>([]) // the steps of the request being worked on
  const chat = useRef(0) // which conversation a reply belongs to; bumped by reset so a late reply is dropped
  const abort = useRef<AbortController | null>(null)

  const ask = async (text: string) => {
    const mine = chat.current
    const history = messages.filter((m) => !m.isError).slice(-8).map((m) => ({ role: m.role, content: m.text }))
    const started = Date.now()
    const controller = new AbortController()
    abort.current = controller
    let steps: Step[] = []
    setMessages((ms) => [...ms, { role: 'user', text }])
    setLive([])
    setBusy(true)
    try {
      let response: CopilotResponse | null = null
      const body = { message: text, history, filters: app.view.f, compare: app.view.compare, lang: app.lang }
      for await (const e of streamEvents<StreamEvent>('copilot/stream', body, controller.signal)) {
        if (mine !== chat.current) return // the chat was restarted while this was running
        if (e.type === 'error') throw new Error(e.message)
        if (e.type === 'done') response = e.response
        steps = reduceSteps(steps, e)
        setLive(steps)
      }
      if (!response) throw new Error(tc('ai_error'))
      if (response.changes.length) app.applyAI(Object.fromEntries(response.changes.map((c) => [c.key, c.to])) as Partial<Filters> & { compare?: Compare })
      if (response.section) app.go(response.section)
      setMessages((ms) => [
        ...ms,
        {
          role: 'assistant',
          text: response.answer,
          changes: response.changes,
          chart: response.chart,
          calc: response.calc,
          remembered: response.remembered?.map((f) => f.text),
          guard: guardStatus(response.guard),
          steps: finishSteps(steps),
          seconds: Math.round((Date.now() - started) / 100) / 10,
        },
      ])
    } catch (e: unknown) {
      if (e instanceof Unauthorized) app.onUnauthorized()
      if (mine !== chat.current) return
      setMessages((ms) => [...ms, { role: 'assistant', text: `${tc('ai_error')} ${errorText(e)}`, isError: true }])
    } finally {
      if (mine === chat.current) {
        setBusy(false)
        setLive([])
      }
    }
  }

  const reset = () => {
    chat.current += 1
    abort.current?.abort() // stops the stream, so the server stops working on it too
    setMessages([])
    setLive([])
    setBusy(false)
  }

  return { messages, ask, isBusy, reset, live }
}
