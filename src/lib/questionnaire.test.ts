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

describe('questionnaire v3 rules', () => {
  const byId = new Map(q.questions.map((x) => [x.id, x]))
  it('status is asked only of non-EU citizens', () => {
    expect(byId.get('status')!.showIf).toEqual({ question: 'citizenship', in: ['best_friend', 'other'] })
  })
  it('exact dates (visa end, move-in) never go to the server', () => {
    expect(byId.get('visa_end')!.storage.server).toBe('none')
    expect(byId.get('move_in')!.storage.server).toBe('none')
  })
  it('every showIf points to an earlier question and a real option', () => {
    const order = q.questions.map((x) => x.id)
    for (const x of q.questions) {
      if (!x.showIf) continue
      const src = byId.get(x.showIf.question)!
      expect(order.indexOf(src.id)).toBeLessThan(order.indexOf(x.id))
      for (const v of x.showIf.in) expect(src.options!.map((o) => o.id), x.id).toContain(v)
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
  migrate,
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
    citizenship: 'other',
    status: 'national_visa',
    visa_end: '2027-02-18',
    arrival: '2026-11-20',
    housing: 'moved_in',
    move_in: '2026-11-22',
    drives: 'maybe',
    place: { state: 'DE-SN', cityId: 'leipzig' },
    household: 'alone',
    german_level: 'basic',
    done_already: ['sim-card'],
  }

  it('asks status, visa end and driving only of non-EU citizens', () => {
    const ids = (a: Answers) => visibleQuestions(a).map((x) => x.id)
    expect(ids({ citizenship: 'best_friend' })).toContain('status')
    expect(ids({ citizenship: 'eu' })).not.toContain('status')
    expect(ids({ citizenship: 'eu' })).not.toContain('drives')
    expect(ids({ citizenship: 'other', status: 'national_visa' })).toContain('visa_end')
    expect(ids({ citizenship: 'other', status: 'visa_free' })).not.toContain('visa_end')
  })

  it('a follow-up of a hidden question stays hidden', () => {
    // status was answered, then citizenship switched to EU: visa_end must disappear too
    const ids = visibleQuestions({ citizenship: 'eu', status: 'national_visa' }).map((x) => x.id)
    expect(ids).not.toContain('visa_end')
  })

  it('asks the move-in date only if there is a home', () => {
    expect(visibleQuestions({ housing: 'soon' }).map((x) => x.id)).toContain('move_in')
    expect(visibleQuestions({ housing: 'searching' }).map((x) => x.id)).not.toContain('move_in')
  })

  it('migrates v2 answers', () => {
    expect(migrate({ eu: 'yes' })).toEqual({ citizenship: 'eu' })
    expect(migrate({ eu: 'no', status: 'temporary' })).toEqual({ citizenship: 'other', status: 'temporary' })
    expect(toProfile({ ...base, citizenship: undefined, eu: 'yes' }).eu).toBe(true)
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

  it('builds a profile and drops non-EU answers for EU citizens', () => {
    expect(toProfile(base)).toMatchObject({
      purpose: 'study', eu: false, citizenship: 'other', status: 'national_visa', visaEnd: '2027-02-18',
      moveIn: '2026-11-22', drives: 'maybe', state: 'DE-SN', cityId: 'leipzig',
    })
    const eu = toProfile({ ...base, citizenship: 'eu' })
    expect(eu.status).toBeUndefined()
    expect(eu.visaEnd).toBeUndefined()
    expect(eu.drives).toBeUndefined()
  })

  it('research payload has the month only and no free text', () => {
    const p = toResearchPayload({ ...base, purpose: 'other', [otherKey('purpose')]: 'secret words' })
    expect(p.plan.arrival_month).toBe('2026-11')
    expect(JSON.stringify(p)).not.toContain('2026-11-20')
    expect(JSON.stringify(p)).not.toContain('secret words')
    expect(JSON.stringify(p)).not.toContain('2027-02-18')
    expect(JSON.stringify(p)).not.toContain('2026-11-22')
    expect(p.plan.citizenship).toBe('other')
  })

  it('normalises city names', () => {
    expect(normalize('München')).toBe(normalize('Muenchen'))
    expect(normalize('Düsseldorf')).toBe(normalize('dusseldorf'))
    expect(normalize('Gießen')).toBe(normalize('giessen'))
  })
})
