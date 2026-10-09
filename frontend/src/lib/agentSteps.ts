// What the agents are doing, as data: the progress events the backend streams (Copilot and Builder) folded into steps.
// No React here; the timeline that shows them is components/AgentActivity.tsx.

/** One line of "what the agents are doing": Jev's routing, a refusal, a deployed agent, or a tool call. */
export type Step = {
  id: string
  kind: 'route' | 'guard' | 'agent' | 'tool'
  name: string // route: the intent; guard: the reason; agent: analyst|charter|builder; tool: the tool's name
  agent?: string // tool: who called it ("copilot" or a subagent)
  task?: string // agent: what it was asked
  args?: Record<string, unknown> // tool: a few safe arguments (never SQL)
  status: 'run' | 'done' | 'fail'
  n?: number | null // tool: how many rows/orders/widgets/documents came back
  unit?: string | null
  agents?: string[] // route: the agents Jev loaded
  source?: string // route: "jev" or "fallback"
}

export type AgentEvent =
  | { type: 'route'; source: string; intent: string | null; subagents: string[] }
  | { type: 'guard'; reason: string | null }
  | { type: 'agent'; name: string; task: string }
  | { type: 'tool'; id: string; agent: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_done'; id: string; ok: boolean; n: number | null; unit: string | null }
  | { type: 'agent_done'; name: string }

/** Events that are not progress (`done`, `error`, ...) leave the steps as they are. */
export function reduceSteps(steps: Step[], e: AgentEvent | { type: string }): Step[] {
  const ev = e as AgentEvent
  switch (ev.type) {
    case 'route':
      return [...steps, { id: 'route', kind: 'route', name: ev.intent ?? ev.source, source: ev.source, agents: ev.subagents, status: 'done' }]
    case 'guard':
      return [...steps, { id: 'guard', kind: 'guard', name: ev.reason ?? 'blocked', status: 'fail' }]
    case 'agent':
      return [...steps, { id: `agent-${steps.length}`, kind: 'agent', name: ev.name, task: ev.task, status: 'run' }]
    case 'tool':
      return [...steps, { id: ev.id, kind: 'tool', name: ev.name, agent: ev.agent, args: ev.args, status: 'run' }]
    case 'tool_done':
      return steps.map((s) => (s.kind === 'tool' && s.id === ev.id ? { ...s, status: ev.ok ? 'done' : 'fail', n: ev.n, unit: ev.unit } : s))
    case 'agent_done': {
      const at = steps.findLastIndex((s) => s.kind === 'agent' && s.name === ev.name && s.status === 'run')
      return at < 0 ? steps : steps.map((s, i) => (i === at ? { ...s, status: 'done' } : s))
    }
    default:
      return steps
  }
}

/** A run that ended: whatever was still running is done. */
export const finishSteps = (steps: Step[]): Step[] => steps.map((s) => (s.status === 'run' ? { ...s, status: 'done' } : s))
