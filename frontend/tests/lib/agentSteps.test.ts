import { describe, expect, it } from 'vitest'
import { finishSteps, reduceSteps } from '../../src/lib/agentSteps'
import type { Step } from '../../src/lib/agentSteps'

type Ev = Parameters<typeof reduceSteps>[1]
const fold = (events: Ev[], from: Step[] = []) => events.reduce(reduceSteps, from)

describe('reduceSteps', () => {
  it('shows a deployed agent with the tools it called and their results', () => {
    const steps = fold([
      { type: 'route', source: 'jev', intent: 'question', subagents: ['analyst'] },
      { type: 'agent', name: 'analyst', task: 'How many orders?' },
      { type: 'tool', id: 't1', agent: 'analyst', name: 'get_kpis', args: { by: 'carrier' } },
      { type: 'tool_done', id: 't1', ok: true, n: 9, unit: 'rows' },
      { type: 'agent_done', name: 'analyst' },
    ])
    expect(steps.map((s) => [s.kind, s.name, s.status])).toEqual([
      ['route', 'question', 'done'],
      ['agent', 'analyst', 'done'],
      ['tool', 'get_kpis', 'done'],
    ])
    expect(steps[2]).toMatchObject({ agent: 'analyst', args: { by: 'carrier' }, n: 9, unit: 'rows' })
  })

  it('marks a tool that failed', () => {
    const steps = fold([
      { type: 'tool', id: 'a', agent: 'copilot', name: 'set_filters', args: {} },
      { type: 'tool_done', id: 'a', ok: false, n: null, unit: null },
    ])
    expect(steps[0].status).toBe('fail')
  })

  it('closes only the latest running deployment of an agent that was deployed twice', () => {
    const steps = fold([
      { type: 'agent', name: 'analyst', task: 'one' },
      { type: 'agent_done', name: 'analyst' },
      { type: 'agent', name: 'analyst', task: 'two' },
      { type: 'agent_done', name: 'analyst' },
    ])
    expect(steps.map((s) => s.status)).toEqual(['done', 'done'])
    const open = fold([{ type: 'agent', name: 'analyst', task: 'one' }, { type: 'agent', name: 'charter', task: 'two' }, { type: 'agent_done', name: 'analyst' }])
    expect(open.map((s) => `${s.name}:${s.status}`)).toEqual(['analyst:done', 'charter:run'])
  })

  it('records a refusal as a failed step', () => {
    expect(fold([{ type: 'guard', reason: 'off_topic' }])).toEqual([{ id: 'guard', kind: 'guard', name: 'off_topic', status: 'fail' }])
  })

  it('leaves the steps alone for events that are not progress', () => {
    const before: Step[] = [{ id: 'x', kind: 'tool', name: 'get_view', status: 'run' }]
    expect(reduceSteps(before, { type: 'done' })).toBe(before)
    expect(reduceSteps(before, { type: 'error' })).toBe(before)
    expect(reduceSteps(before, { type: 'agent_done', name: 'nobody' })).toBe(before)
  })
})

describe('finishSteps', () => {
  it('turns what was still running into done and keeps failures', () => {
    const steps: Step[] = [
      { id: '1', kind: 'tool', name: 'a', status: 'run' },
      { id: '2', kind: 'tool', name: 'b', status: 'fail' },
    ]
    expect(finishSteps(steps).map((s) => s.status)).toEqual(['done', 'fail'])
  })
})
