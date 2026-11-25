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
