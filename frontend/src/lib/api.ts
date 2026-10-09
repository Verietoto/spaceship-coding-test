import { toParams } from './filterQuery'
import type { Filters } from './types'

// The API client: every request goes to /api/<path> with the session cookie.
export class Unauthorized extends Error {}
/** A failed request that carries its HTTP status (429 = a rate limit was hit). */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type Params = Record<string, string | number | boolean | string[]>

export function apiUrl(path: string, params: Params = {}): string {
  // An array is sent as a repeated parameter (carrier=UPS&carrier=FedEx), never joined: values may contain commas.
  const pairs = Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, String(v)]]))
  const qs = new URLSearchParams(pairs).toString()
  return `/api/${path}${qs ? `?${qs}` : ''}`
}

export async function api<T>(path: string, params: Params = {}, body?: unknown, method?: string): Promise<T> {
  const r = await fetch(apiUrl(path, params), {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (r.status === 401) throw new Unauthorized()
  if (!r.ok) {
    const detail = await r.json().then((j: { detail?: unknown }) => j.detail, () => undefined)
    throw new ApiError(failureText(detail, r.statusText), r.status)
  }
  return r.json() as Promise<T>
}

/** What a failed response says. FastAPI sends a string for its own errors and a list of {loc, msg} for a request that did not
 * validate: show which field and why, not just "Unprocessable Entity". */
export function failureText(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const lines = detail.flatMap((d: { loc?: unknown[]; msg?: unknown }) =>
      typeof d?.msg === 'string' ? [`${(d.loc ?? []).filter((x) => x !== 'body').join('.')}: ${d.msg}`] : [],
    )
    if (lines.length) return lines.slice(0, 3).join('; ')
  }
  return fallback
}

/** Filters as query params for the API. */
export const fq = (f: Filters): Params => toParams(f)

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** POST and read a newline-delimited JSON stream: one parsed event per line, as it arrives. */
export async function* streamEvents<T>(path: string, body: unknown, signal?: AbortSignal): AsyncGenerator<T> {
  const r = await fetch(apiUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (r.status === 401) throw new Unauthorized()
  if (!r.ok || !r.body) {
    const detail = await r.json().then((j: { detail?: unknown }) => j.detail, () => undefined)
    throw new ApiError(failureText(detail, r.statusText), r.status)
  }
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
      const line = buffer.slice(0, end).trim()
      buffer = buffer.slice(end + 1)
      if (line) yield JSON.parse(line) as T
    }
  }
}

