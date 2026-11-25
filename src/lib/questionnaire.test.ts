import { describe, expect, it } from 'vitest'
import q from '../content/questionnaire.json'
import scenario from '../content/first30days.de.json'

describe('questionnaire integrity', () => {
  it('has unique question ids and unique option ids per question', () => {
    const ids = q.questions.map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const x of q.questions) {
      const opts = (x.options ?? []).map((o) => o.id)
      expect(new Set(opts).size, x.id).toBe(opts.length)
    }
  })

  it('every question belongs to a known part, and consents exist', () => {
    const parts = new Set(q.parts.map((p) => p.id))
    for (const x of q.questions) expect(parts.has(x.part), x.id).toBe(true)
    for (const p of q.parts) if (p.consent) expect(Object.keys(q.consents)).toContain(p.consent)
  })

  it('"already done" options are real task ids', () => {
    const taskIds = new Set(scenario.tasks.map((t) => t.id))
    const done = q.questions.find((x) => x.id === 'done_already')!
    for (const o of done.options!) expect(taskIds.has(o.id), o.id).toBe(true)
  })

  it('the exact arrival date never goes to the server', () => {
    const arrival = q.questions.find((x) => x.id === 'arrival')!
    expect(arrival.storage.server).toBe('month')
  })

  it('choice questions have options; others do not', () => {
    for (const x of q.questions) {
      const isChoice = x.type === 'single' || x.type === 'multi'
      expect(Boolean(x.options?.length), x.id).toBe(isChoice)
    }
  })

  it('research consent is opt-in', () => {
    expect(q.consents.research_v1.default).toBe(false)
  })
})

describe('questionnaire v2 rules', () => {
  const byId = new Map(q.questions.map((x) => [x.id, x]))
  it('status is asked only of non-EU citizens', () => {
    const st = byId.get('status')!
    expect(st.showIf).toEqual({ question: 'eu', equals: 'no' })
    expect(byId.get('eu')!.options!.map((o) => o.id)).toContain('no')
  })
  it('every showIf points to an earlier question and a real option', () => {
    const order = q.questions.map((x) => x.id)
    for (const x of q.questions) {
      if (!x.showIf) continue
      const src = byId.get(x.showIf.question)!
      expect(order.indexOf(src.id)).toBeLessThan(order.indexOf(x.id))
      expect(src.options!.map((o) => o.id)).toContain(x.showIf.equals)
    }
  })
  it('free text is only offered on "other" options', () => {
    for (const x of q.questions) for (const o of x.options ?? []) if ('freeText' in o) expect(o.id).toBe('other')
  })
  it("status options match the engine type", () => {
    const ids = byId.get('status')!.options!.map((o) => o.id).sort()
    expect(ids).toEqual(
      ['not_arrived', 'visa_free', 'national_visa', 'fiktion', 'temporary', 'blue_card', 'chancenkarte', 'permanent', 'protection', 'not_sure', 'other'].sort(),
    )
  })
  it('only the plan part is enabled for now', () => {
    expect(q.parts.filter((p) => p.enabled).map((p) => p.id)).toEqual(['plan'])
  })
})

import {
  activeQuestions,
  canContinue,
  normalize,
  otherKey,
  toProfile,
  toResearchPayload,
  visibleQuestions,
  type Answers,
} from './questionnaire'

describe('questionnaire logic', () => {
  const base: Answers = {
    purpose: 'study',
    eu: 'no',
    status: 'national_visa',
    arrival: '2026-11-20',
    place: { state: 'DE-SN', cityId: 'leipzig' },
    household: 'alone',
    german_level: 'basic',
    done_already: ['sim-card'],
  }

  it('asks the status question only of non-EU citizens', () => {
    expect(visibleQuestions({ eu: 'no' }).map((x) => x.id)).toContain('status')
    expect(visibleQuestions({ eu: 'yes' }).map((x) => x.id)).not.toContain('status')
  })

  it('shows only enabled parts', () => {
    expect(activeQuestions.every((x) => x.part === 'plan')).toBe(true)
  })

  it('"Something else" needs text before continuing', () => {
    const purpose = activeQuestions.find((x) => x.id === 'purpose')!
    expect(canContinue(purpose, { purpose: 'other' })).toBe(false)
    expect(canContinue(purpose, { purpose: 'other', [otherKey('purpose')]: 'Au pair' })).toBe(true)
    expect(canContinue(purpose, { purpose: 'study' })).toBe(true)
  })

  it('optional questions can be skipped', () => {
    const done = activeQuestions.find((x) => x.id === 'done_already')!
    expect(canContinue(done, {})).toBe(true)
  })

  it('builds a profile and drops the status for EU citizens', () => {
    expect(toProfile(base)).toMatchObject({ purpose: 'study', eu: false, status: 'national_visa', state: 'DE-SN', cityId: 'leipzig' })
    expect(toProfile({ ...base, eu: 'yes' }).status).toBeUndefined()
  })

  it('research payload has the month only and no free text', () => {
    const p = toResearchPayload({ ...base, purpose: 'other', [otherKey('purpose')]: 'secret words' })
    expect(p.plan.arrival_month).toBe('2026-11')
    expect(JSON.stringify(p)).not.toContain('2026-11-20')
    expect(JSON.stringify(p)).not.toContain('secret words')
  })

  it('normalises city names', () => {
    expect(normalize('München')).toBe(normalize('Muenchen'))
    expect(normalize('Düsseldorf')).toBe(normalize('dusseldorf'))
    expect(normalize('Gießen')).toBe(normalize('giessen'))
  })
})
