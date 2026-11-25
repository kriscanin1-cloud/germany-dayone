// Everything the app remembers lives on the device under one key.
// Every access is wrapped: private mode or blocked storage must never break the app.
import type { Profile } from './types'

const KEY = 'dayone.v1'

export interface Saved {
  anonId: string
  profile?: Profile
  done: string[]
  createdAt: string
}

let memory: Saved | null = null

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
