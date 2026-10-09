// What the agents are doing, as a timeline: Jev's routing, each deployed agent as a card with the tools it calls, each tool
// with its result. Live while a request runs; folded under the answer afterwards (Copilot panel, Builder).
import { useMessages } from '../i18n'
import { copilot as copilotMsg } from '../i18n/copilot'
import type { Step } from '../lib/agentSteps'
import { GlowIcon } from './GlowIcon'
import type { Tone } from './GlowIcon'
import { Icon } from './Icon'
import type { IconName } from './Icon'

type Look = { icon: IconName; tone: Tone; name: 'agent_analyst' | 'agent_charter' | 'agent_builder' | 'agent_subagent'; desc: 'agent_analyst_d' | 'agent_charter_d' | 'agent_builder_d' | 'agent_subagent_d' }
const LOOK: Record<string, Look> = {
  analyst: { icon: 'bars', tone: 't2', name: 'agent_analyst', desc: 'agent_analyst_d' },
  charter: { icon: 'hist', tone: 't5', name: 'agent_charter', desc: 'agent_charter_d' },
  builder: { icon: 'box', tone: 't3', name: 'agent_builder', desc: 'agent_builder_d' },
}
const OTHER: Look = { icon: 'sparkle', tone: 'ai', name: 'agent_subagent', desc: 'agent_subagent_d' }
const TOOLS = {
  get_view: 'tool_get_view', get_kpis: 'tool_get_kpis', get_facets: 'tool_get_facets', run_sql: 'tool_run_sql', make_chart: 'tool_make_chart',
  create_dashboard: 'tool_create_dashboard', set_filters: 'tool_set_filters', open_section: 'tool_open_section', remember: 'tool_remember', search_kb: 'tool_search_kb',
} as const
const COUNTS = { rows: 'n_rows', orders: 'n_orders', widgets: 'n_widgets', docs: 'n_docs' } as const
const GUARDS = { off_topic: 'g_off_topic', prompt_injection: 'g_prompt_injection', sensitive_data: 'g_sensitive_data' } as const

/** The text key for a name the backend sent, or undefined for one this UI does not know yet. */
const known = <T extends Record<string, string>>(map: T, name: string): T[keyof T] | undefined => (Object.hasOwn(map, name) ? map[name as keyof T] : undefined)

type Node = { step: Step; tools: Step[] }

/** Tools called by a deployed agent hang under its card; everything else is a top-level line. */
function tree(steps: Step[]): Node[] {
  const nodes: Node[] = []
  const deployed = new Map<string, Node>() // agent name -> its latest deployment
  for (const step of steps) {
    const owner = step.kind === 'tool' && step.agent ? deployed.get(step.agent) : undefined
    if (owner) {
      owner.tools.push(step)
    } else {
      const node = { step, tools: [] }
      nodes.push(node)
      if (step.kind === 'agent') deployed.set(step.name, node)
    }
  }
  return nodes
}

/** The icon is decoration; `label` says the state to screen readers (running, done, failed). */
function Mark({ status, label }: { status: Step['status']; label: string }) {
  return (
    <span className={`trace-st ${status}`}>
      <span aria-hidden="true">{status === 'run' ? <span className="trace-spin" /> : <Icon name={status === 'done' ? 'check' : 'close'} size={13} />}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function AgentActivity({ steps, live = false }: { steps: Step[]; live?: boolean }) {
  const t = useMessages(copilotMsg)
  const look = (name: string): Look => LOOK[name] ?? OTHER
  const agentName = (name: string) => t(look(name).name)
  const statusText = (status: Step['status']) => t(status === 'run' ? 'trace_st_run' : status === 'done' ? 'trace_st_done' : 'trace_st_fail')
  const chips = (args: Step['args']) => Object.values(args ?? {}).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((v) => v !== false && v !== '').slice(0, 8)

  const tool = (s: Step) => {
    const nameKey = known(TOOLS, s.name)
    const countKey = s.n != null && s.unit ? known(COUNTS, s.unit) : undefined
    return (
      <li key={s.id} className={`trace-row ${s.status}`}>
        <Mark status={s.status} label={statusText(s.status)} />
        <span className="trace-label">{nameKey ? t(nameKey) : s.name}</span>
        {chips(s.args).map((c, i) => <span key={i} className="trace-chip">{String(c)}</span>)}
        {countKey && <span className="trace-n">{t(countKey, { n: s.n ?? 0 })}</span>}
      </li>
    )
  }

  const line = ({ step, tools }: Node) => {
    if (step.kind === 'route') {
      const text = step.agents?.length ? (step.source === 'fallback' ? t('trace_route_all') : t('trace_route_agents', { a: step.agents.map(agentName).join(', ') })) : t('trace_route_none')
      return (
        <li key={step.id} className="trace-row done">
          <span className="trace-jev">Jev</span>
          <span className="trace-label">{text}</span>
        </li>
      )
    }
    if (step.kind === 'guard') {
      const reason = known(GUARDS, step.name)
      return (
        <li key={step.id} className="trace-row fail">
          <Mark status="fail" label={statusText('fail')} />
          <span className="trace-label">{t('trace_guard', { r: reason ? t(reason) : step.name })}</span>
        </li>
      )
    }
    if (step.kind === 'agent') {
      const l = look(step.name)
      return (
        <li key={step.id}>
          <div className={`agent-card ${step.status}`} data-agent={step.name}>
            <div className="agent-head">
              <GlowIcon name={l.icon} tone={l.tone} size={30} breathe={step.status === 'run'} />
              <div className="agent-title">
                <strong>{agentName(step.name)}</strong>
                <span className="muted xsmall">{t('trace_deployed')} · {t(l.desc)}</span>
              </div>
              <Mark status={step.status} label={statusText(step.status)} />
            </div>
            {step.task && <p className="agent-task">{step.task}</p>}
            {tools.length > 0 && <ol className="trace">{tools.map(tool)}</ol>}
          </div>
        </li>
      )
    }
    return tool(step)
  }

  const waiting = live && !steps.some((s) => s.status === 'run')
  return (
    <ol className={`trace${live ? ' live' : ''}`} aria-label={t('trace_title')}>
      {tree(steps).map(line)}
      {waiting && (
        <li className="trace-row run">
          <Mark status="run" label={statusText('run')} />
          <span className="trace-label trace-shimmer">{t(steps.length ? 'trace_thinking' : 'trace_working')}</span>
        </li>
      )}
    </ol>
  )
}
