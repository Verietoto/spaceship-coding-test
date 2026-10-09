// The Builder's flow as a state machine: ask until the request is clear (pick an option or type), build with live progress,
// hold the draft, save it. The page (Builder.tsx) only draws it.
import { useRef, useState } from 'react'
import { useApp } from '../../app/useApp'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { finishSteps, reduceSteps } from '../../lib/agentSteps'
import type { AgentEvent, Step } from '../../lib/agentSteps'
import { Unauthorized, api, errorText, streamEvents } from '../../lib/api'
import type { Draft } from './types'

/** A draft as the API takes it (save and refine): without the rows and errors of the last run. */
export const draftSpec = (d: Draft, keepFailed: boolean) => ({
  title: d.title,
  plan: d.plan,
  widgets: d.widgets.filter((w) => keepFailed || !w.error).map(({ rows: _rows, error: _error, ...w }) => w),
  filters: d.filters ?? [],
})

export type Answer = { question: string; answer: string }
export type Ask = { status: 'ask'; question: string; options: string[]; round: number; max: number }
type Clarify = { status: 'ready' } | Ask | { status: 'refused'; message: string }
type BuildEvent = AgentEvent | { type: 'done'; dashboard: Draft } | { type: 'refused'; message: string } | { type: 'message'; text: string } | { type: 'error'; status: number; message: string }
export type Phase = 'idle' | 'checking' | 'asking' | 'building' | 'draft'
const clock = () => Date.now() // read inside event handlers only

export function useBuilderFlow() {
  const { lang, onUnauthorized } = useApp()
  const tc = useMessages(common)
  const [phase, setPhase] = useState<Phase>('idle')
  const [request, setRequest] = useState('') // the prompt the questions are about
  const [answers, setAnswers] = useState<Answer[]>([])
  const [ask, setAsk] = useState<Ask | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [seconds, setSeconds] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftKey, setDraftKey] = useState(0) // changes with every new draft, so what hangs off a draft (its filter values) starts over
  const [previous, setPrevious] = useState<Draft | null>(null) // the draft before the last change, for undo
  const [error, setError] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null) // the Builder answered or asked something instead of drafting
  const [isSaving, setSaving] = useState(false)
  const run = useRef(0) // which attempt a reply belongs to; bumped by reset so a late reply is dropped
  const abort = useRef<AbortController | null>(null)

  const fail = (e: unknown, back: Phase = 'idle') => {
    if (e instanceof Unauthorized) onUnauthorized()
    setError(errorText(e))
    setPhase(back)
  }

  /** `changing`: the draft on screen is sent along and `text` is a change to it; a failure leaves that draft showing. */
  const build = async (text: string, given: Answer[], changing: Draft | null = null) => {
    const back: Phase = changing ? 'draft' : 'idle'
    const mine = run.current
    const controller = new AbortController()
    abort.current = controller
    const started = clock()
    let seen: Step[] = []
    setPhase('building')
    setSteps([])
    try {
      for await (const e of streamEvents<BuildEvent>('builder/stream', { prompt: text, answers: given, lang, ...(changing && { draft: draftSpec(changing, true) }) }, controller.signal)) {
        if (mine !== run.current) return
        if (e.type === 'error') throw new Error(e.message)
        if (e.type === 'message') {
          setReply(e.text)
          setPhase(back)
          return
        }
        if (e.type === 'refused') {
          setRefused(e.message)
          setPhase(back)
          return
        }
        if (e.type === 'done') {
          if (changing) setPrevious(changing)
          seen = finishSteps(seen)
          setSteps(seen)
          setSeconds(Math.round((clock() - started) / 100) / 10)
          setDraft(e.dashboard)
          setDraftKey((k) => k + 1)
          setPhase('draft')
          return
        }
        seen = reduceSteps(seen, e)
        setSteps(seen)
      }
      throw new Error(tc('ai_error')) // the stream ended without a draft
    } catch (e: unknown) {
      if (mine === run.current) fail(e, back)
    }
  }

  /** Is the request clear enough? Then build; otherwise show the next question. */
  const next = async (text: string, given: Answer[]) => {
    const mine = run.current
    setPhase('checking')
    setAsk(null)
    setError(null)
    setRefused(null)
    setReply(null)
    try {
      const r = await api<Clarify>('builder/clarify', {}, { prompt: text, answers: given, lang })
      if (mine !== run.current) return
      if (r.status === 'ask') {
        setAsk(r)
        setPhase('asking')
      } else if (r.status === 'refused') {
        setRefused(r.message)
        setPhase('idle')
      } else {
        await build(text, given)
      }
    } catch (e: unknown) {
      if (mine === run.current) fail(e)
    }
  }

  return {
    phase, answers, ask, steps, seconds, draft, draftKey, error, refused, reply, isSaving, canUndo: previous !== null,
    /** A new request: forget the last one's answers and draft. */
    start: (text: string) => {
      setRequest(text)
      setAnswers([])
      setDraft(null)
      setPrevious(null)
      void next(text, [])
    },
    /** Change the draft on screen with a prompt (no questions: the user has seen the result). `base`: a saved dashboard to change when
     * there is no draft yet. */
    refine: (text: string, base?: Draft) => {
      const from = draft ?? base
      if (!from || text.trim().length < 3) return
      setError(null)
      setRefused(null)
      setReply(null)
      void build(text.trim(), [], from)
    },
    undo: () => {
      if (!previous) return
      setDraft(previous)
      setDraftKey((k) => k + 1)
      setPrevious(null)
    },
    /** Answer the question on screen; false when there is nothing to answer with. */
    answer: (text: string): boolean => {
      if (!ask || !text.trim()) return false
      const given = [...answers, { question: ask.question, answer: text.trim() }]
      setAnswers(given)
      void next(request, given)
      return true
    },
    skip: () => void build(request, answers),
    reset: () => {
      run.current += 1
      abort.current?.abort() // stops the build on the server too
      setPhase('idle')
      setDraft(null)
      setPrevious(null)
      setAnswers([])
      setAsk(null)
      setSteps([])
      setError(null)
      setRefused(null)
      setReply(null)
    },
    /** Save the draft as a new dashboard, or (`editId`) as the new version of a saved one. */
    save: async (onSaved: (id: number) => void, editId?: number) => {
      if (!draft) return
      setSaving(true)
      setError(null)
      try {
        const { id } = await (editId == null ? api<{ id: number }>('dashboards', {}, draftSpec(draft, false)) : api<{ id: number }>(`dashboards/${editId}`, {}, draftSpec(draft, false), 'PUT'))
        onSaved(id)
      } catch (e: unknown) {
        if (e instanceof Unauthorized) onUnauthorized()
        setError(errorText(e))
      } finally {
        setSaving(false)
      }
    },
  }
}
