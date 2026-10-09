import { describe, expect, it } from 'vitest'
import { failureText } from '../../src/lib/api'

describe('failureText', () => {
  it('keeps the message of a plain error', () => {
    expect(failureText('wrong email or password', 'Unauthorized')).toBe('wrong email or password')
  })
  it('names the field and the reason of a request that did not validate', () => {
    const detail = [{ type: 'string_too_long', loc: ['body', 'history', 3, 'content'], msg: 'String should have at most 4000 characters' }]
    expect(failureText(detail, 'Unprocessable Entity')).toBe('history.3.content: String should have at most 4000 characters')
  })
  it('shows at most three problems', () => {
    const detail = Array.from({ length: 5 }, (_, i) => ({ loc: ['body', `f${i}`], msg: 'bad' }))
    expect(failureText(detail, 'x').split('; ')).toHaveLength(3)
  })
  it('falls back to the status text when it cannot read the detail', () => {
    for (const odd of [undefined, null, 42, [], [{}], [{ loc: ['body'] }]]) expect(failureText(odd, 'Unprocessable Entity')).toBe('Unprocessable Entity')
  })
})
