// Everything the app remembers lives on the device under one key.
// Every access is wrapped: private mode or blocked storage must never break the app.
import type { Answers } from './questionnaire'
import type { Profile } from './types'

const KEY = 'dayone.v1'

export interface Saved {
  anonId: string
  profile?: Profile
  /** raw questionnaire answers, incl. free text — device only */
  answers?: Answers
  /** consent id the person ticked, e.g. 'research_v1' */
  consent?: string
  done: string[]
  createdAt: string
}

let memory: Saved | null = null

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    // RFC 4122-shaped fallback so the id still fits the uuid column
    const h = () => Math.floor(Math.random() * 16).toString(16)
    const s = (n: number) => Array.from({ length: n }, h).join('')
    return `${s(8)}-${s(4)}-4${s(3)}-a${s(3)}-${s(12)}`
  }
}

export function load(): Saved {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Saved
      if (parsed && typeof parsed.anonId === 'string' && Array.isArray(parsed.done)) {
        memory = parsed
        return parsed
      }
    }
  } catch {
    /* fall through to a fresh state */
  }
  memory = { anonId: newId(), done: [], createdAt: new Date().toISOString() }
  save(memory)
  return memory
}

export function save(next: Saved): void {
  memory = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* keep the in-memory copy only */
  }
}

export function update(change: (s: Saved) => Saved): Saved {
  const next = change(load())
  save(next)
  return next
}

/** "Delete my data": clears the device copy and starts over with a new anonymous id. */
export function wipe(): void {
  memory = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}
