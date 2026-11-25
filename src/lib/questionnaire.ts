// Questionnaire model: which questions are visible, when an answer is complete,
// and how answers turn into a Profile. Pure functions, unit-tested.
import raw from '../content/questionnaire.json'
import type { Citizenship, Profile, Purpose, ResidenceStatus, StateCode } from './types'

export interface QOption {
  id: string
  label: string
  freeText?: boolean
}

export interface Question {
  id: string
  part: string
  type: 'single' | 'multi' | 'date' | 'city' | 'email'
  required: boolean
  text: string
  help?: string
  max?: number
  options?: QOption[]
  /** shown only if the answer to `question` is one of `in` */
  showIf?: { question: string; in: string[] }
  /** date questions: allowed range in days from today */
  range?: { minDays: number; maxDays: number }
  storage: { device: string; server: string }
}

interface Questionnaire {
  version: string
  parts: { id: string; enabled?: boolean; optionalConsent?: string }[]
  questions: Question[]
  consents: Record<string, { text: string; default: boolean }>
}

export const questionnaire = raw as unknown as Questionnaire

export interface Place {
  state: StateCode
  cityId?: string
}

/** single → option id, multi → option ids, date → YYYY-MM-DD, city → Place, `${id}__other` → free text */
export type Answers = Record<string, string | string[] | Place | undefined>

const enabledParts = new Set(questionnaire.parts.filter((p) => p.enabled).map((p) => p.id))
export const activeQuestions = questionnaire.questions.filter((q) => enabledParts.has(q.part))
export const CONSENT_ID = questionnaire.parts.find((p) => p.id === 'plan')?.optionalConsent ?? null

export function otherKey(questionId: string): string {
  return `${questionId}__other`
}

/** v2 asked `eu: yes|no`; v3 asks `citizenship`. Old saved answers are read as the closest v3 answer. */
export function migrate(answers: Answers): Answers {
  if (answers.citizenship || !answers.eu) return answers
  const { eu, ...rest } = answers
  return { ...rest, citizenship: eu === 'yes' ? 'eu' : 'other' }
}

export function visibleQuestions(answers: Answers, questions: Question[] = activeQuestions): Question[] {
  // A question is visible if its condition holds. Conditions chain: hidden questions don't count as answered.
  const shown: Question[] = []
  const shownIds = new Set<string>()
  for (const q of questions) {
    if (q.showIf) {
      const a = answers[q.showIf.question]
      if (!shownIds.has(q.showIf.question) || typeof a !== 'string' || !q.showIf.in.includes(a)) continue
    }
    shown.push(q)
    shownIds.add(q.id)
  }
  return shown
}

export function isAnswered(q: Question, answers: Answers): boolean {
  const a = answers[q.id]
  switch (q.type) {
    case 'single': {
      if (typeof a !== 'string' || !a) return false
      const opt = q.options?.find((o) => o.id === a)
      if (!opt) return false
      // "Something else" needs a few words
      if (opt.freeText) return typeof answers[otherKey(q.id)] === 'string' && (answers[otherKey(q.id)] as string).trim().length > 0
      return true
    }
    case 'multi':
      return Array.isArray(a) && a.length > 0
    case 'date':
      return typeof a === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a)
    case 'city':
      return typeof a === 'object' && a !== null && !Array.isArray(a) && typeof (a as Place).state === 'string'
    case 'email':
      return typeof a === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)
  }
}

/** A question can be passed if it is answered, or if it is optional. */
export function canContinue(q: Question, answers: Answers): boolean {
  return isAnswered(q, answers) || (!q.required && !(q.type === 'single' && answers[q.id]))
}

const str = (v: Answers[string]) => (typeof v === 'string' && v ? v : undefined)

export function toProfile(input: Answers): Profile {
  const answers = migrate(input)
  // only answers to questions that are actually shown count
  const shown = new Set(visibleQuestions(answers, questionnaire.questions).map((q) => q.id))
  const get = (id: string) => (shown.has(id) ? str(answers[id]) : undefined)
  const place = answers.place as Place
  const citizenship = (get('citizenship') ?? 'other') as Citizenship
  return {
    purpose: answers.purpose as Purpose,
    eu: citizenship === 'eu',
    citizenship,
    status: get('status') as ResidenceStatus | undefined,
    arrival: answers.arrival as string,
    state: place.state,
    cityId: place.cityId,
    household: get('household'),
    germanLevel: get('german_level'),
    housing: get('housing'),
    moveIn: get('move_in'),
    visaEnd: get('visa_end'),
    drives: get('drives'),
  }
}

/** Ids of tasks the person said are already done. */
export function doneFromAnswers(answers: Answers): string[] {
  const a = answers.done_already
  return Array.isArray(a) ? a : []
}

/** Coarse, consent-only payload for the `responses` table. Never free text, never the exact date. */
export function toResearchPayload(answers: Answers) {
  const p = toProfile(answers)
  return {
    questionnaire_version: questionnaire.version,
    plan: {
      purpose: p.purpose,
      eu: p.eu,
      citizenship: p.citizenship ?? null,
      status: p.status ?? null,
      arrival_month: p.arrival.slice(0, 7),
      state: p.state,
      city_id: p.cityId ?? null,
      household: p.household ?? null,
      german_level: p.germanLevel ?? null,
      housing: p.housing ?? null,
      drives: p.drives ?? null,
      done_already: doneFromAnswers(answers),
    },
    research: {},
  }
}

/** Lower-case, no accents, German umlaut spellings folded (München = Muenchen = Munchen). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
