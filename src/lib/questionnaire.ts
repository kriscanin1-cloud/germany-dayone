// Questionnaire model: which questions are visible, when an answer is complete,
// and how answers turn into a Profile. Pure functions, unit-tested.
import raw from '../content/questionnaire.json'
import type { Profile, Purpose, ResidenceStatus, StateCode } from './types'

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
  showIf?: { question: string; equals: string }
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

export function visibleQuestions(answers: Answers, questions: Question[] = activeQuestions): Question[] {
  return questions.filter((q) => !q.showIf || answers[q.showIf.question] === q.showIf.equals)
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

export function toProfile(answers: Answers): Profile {
  const place = answers.place as Place
  const eu = answers.eu === 'yes'
  return {
    purpose: answers.purpose as Purpose,
    eu,
    status: eu ? undefined : (answers.status as ResidenceStatus | undefined),
    arrival: answers.arrival as string,
    state: place.state,
    cityId: place.cityId,
    household: answers.household as string | undefined,
    germanLevel: answers.german_level as string | undefined,
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
      status: p.status ?? null,
      arrival_month: p.arrival.slice(0, 7),
      state: p.state,
      city_id: p.cityId ?? null,
      household: p.household ?? null,
      german_level: p.germanLevel ?? null,
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
