// Everything the app remembers lives on the device under one key.
// Every access is wrapped: private mode or blocked storage must never break the app.
import type { Meetup, Rsvp } from './people'
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
  /** activity ids the person removed with × */
  removed?: string[]
  /** activity ids the person ticked as tried */
  tried?: string[]
  /** People tab (fake door): meetups you created, your RSVPs and the notify switch — device only */
  meetups?: Meetup[]
  rsvps?: Record<string, Rsvp>
  notifyMeetups?: boolean
  /** Me tab: what you choose to share at meetups, plus private dates — device only */
  me?: MeInfo
  createdAt: string
}

export interface MeInfo {
  /** first name or nickname — no surname needed */
  name?: string
  languages?: string[]
  interests?: string[]
  /** one line about you, max 120 characters */
  about?: string
  /** ISO date, private — for a renewal reminder */
  passportEnd?: string
}

let memory: Saved | null = null

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    // older browsers without randomUUID: still a cryptographically random v4 uuid
    const b = crypto.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strings = (v: unknown, max = 500): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length <= 200).slice(0, max) : undefined

/**
 * localStorage is input like any other: it can be edited, corrupted or from an older version.
 * Keep only fields of the expected type, so a bad value can't crash a screen.
 */
export function sanitize(raw: unknown): Saved | null {
  if (!isObj(raw) || typeof raw.anonId !== 'string' || !UUID.test(raw.anonId)) return null
  const out: Saved = {
    anonId: raw.anonId,
    done: strings(raw.done) ?? [],
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  }
  if (isObj(raw.profile) && typeof raw.profile.arrival === 'string' && typeof raw.profile.state === 'string' && typeof raw.profile.purpose === 'string')
    out.profile = raw.profile as unknown as Saved['profile']
  if (isObj(raw.answers)) out.answers = raw.answers as Saved['answers']
  if (typeof raw.consent === 'string') out.consent = raw.consent
  out.removed = strings(raw.removed)
  out.tried = strings(raw.tried)
  if (Array.isArray(raw.meetups)) out.meetups = raw.meetups.filter(isObj).slice(0, 100) as unknown as Saved['meetups']
  if (isObj(raw.rsvps)) out.rsvps = Object.fromEntries(Object.entries(raw.rsvps).filter(([, v]) => v === 'interested' || v === 'going')) as Saved['rsvps']
  if (typeof raw.notifyMeetups === 'boolean') out.notifyMeetups = raw.notifyMeetups
  if (isObj(raw.me))
    out.me = {
      name: typeof raw.me.name === 'string' ? raw.me.name.slice(0, 30) : undefined,
      about: typeof raw.me.about === 'string' ? raw.me.about.slice(0, 120) : undefined,
      languages: strings(raw.me.languages, 20),
      interests: strings(raw.me.interests, 30),
      passportEnd: typeof raw.me.passportEnd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.me.passportEnd) ? raw.me.passportEnd : undefined,
    }
  return out
}

export function load(): Saved {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = sanitize(JSON.parse(raw))
      if (parsed) {
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
