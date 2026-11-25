import { describe, expect, it } from 'vitest'
import scenario from '../content/first30days.de.json'
import places from '../content/places.de.json'
import { applies, bucketFor, dueDate, orderTasks, parseDate, planEntitlements, planMilestones, planTasks } from './engine'
import type { Profile, Scenario } from './types'

const s = scenario as unknown as Scenario
const today = parseDate('2026-10-05')

const student: Profile = { purpose: 'study', eu: false, arrival: '2026-10-01', state: 'DE-BE', cityId: 'berlin' }
const euWorker: Profile = { purpose: 'work', eu: true, arrival: '2026-10-01', state: 'DE-BY', cityId: 'muenchen' }

describe('content integrity', () => {
  it('every dependency points to an existing task and there are no cycles', () => {
    const ids = new Set(s.tasks.map((t) => t.id))
    for (const t of s.tasks) for (const d of t.dependsOn) expect(ids.has(d), `${t.id} -> ${d}`).toBe(true)
    expect(() => orderTasks(s.tasks)).not.toThrow()
  })

  it('a dependency is never due after the task that needs it (when only the arrival date is known)', () => {
    const byId = new Map(s.tasks.map((t) => [t.id, t]))
    for (const t of s.tasks)
      for (const d of t.dependsOn)
        expect(dueDate(byId.get(d)!, student).getTime(), `${d} before ${t.id}`).toBeLessThanOrEqual(dueDate(t, student).getTime())
  })

  it('every milestone has a "when"', () => {
    for (const m of s.milestones) expect(m.when.en.length, m.id).toBeGreaterThan(0)
  })

  it('every city maps to one of the 16 states', () => {
    const codes = new Set(places.states.map((x) => x.code))
    expect(codes.size).toBe(16)
    for (const c of places.cities) expect(codes.has(c.state), c.id).toBe(true)
  })
})

describe('applies', () => {
  it('hides permit tasks for EU citizens', () => {
    const permit = s.tasks.find((t) => t.id === 'residence-permit')!
    expect(applies(permit.appliesTo, student)).toBe(true)
    expect(applies(permit.appliesTo, euWorker)).toBe(false)
  })

  it('filters by purpose', () => {
    const enrol = s.tasks.find((t) => t.id === 'university-enrolment')!
    expect(applies(enrol.appliesTo, student)).toBe(true)
    expect(applies(enrol.appliesTo, euWorker)).toBe(false)
  })

  it('filters by state and city', () => {
    expect(applies({ purposes: 'all', states: ['DE-BE'] }, student)).toBe(true)
    expect(applies({ purposes: 'all', states: ['DE-BY'] }, student)).toBe(false)
    expect(applies({ purposes: 'all', cities: ['berlin'] }, student)).toBe(true)
    expect(applies({ purposes: 'all', cities: ['berlin'] }, { ...student, cityId: undefined })).toBe(false)
  })
})

describe('planTasks', () => {
  it('hides drafts unless asked', () => {
    expect(planTasks(s.tasks, student, [], { today })).toHaveLength(0)
    expect(planTasks(s.tasks, student, [], { today, showDrafts: true }).length).toBeGreaterThan(0)
  })

  it('puts dependencies before dependants', () => {
    const plan = planTasks(s.tasks, student, [], { today, showDrafts: true }).map((p) => p.task.id)
    expect(plan.indexOf('anmeldung')).toBeLessThan(plan.indexOf('residence-permit'))
    expect(plan.indexOf('health-insurance')).toBeLessThan(plan.indexOf('university-enrolment'))
  })

  it('marks done and blocked tasks', () => {
    const plan = planTasks(s.tasks, student, ['health-insurance'], { today, showDrafts: true })
    const hi = plan.find((p) => p.task.id === 'health-insurance')!
    const rp = plan.find((p) => p.task.id === 'residence-permit')!
    expect(hi.bucket).toBe('done')
    expect(rp.blockedBy).toEqual(['anmeldung'])
  })

  it('gives students and EU workers different plans', () => {
    const a = planTasks(s.tasks, student, [], { today, showDrafts: true }).map((p) => p.task.id)
    const b = planTasks(s.tasks, euWorker, [], { today, showDrafts: true }).map((p) => p.task.id)
    expect(a).toContain('university-enrolment')
    expect(b).not.toContain('residence-permit')
    expect(b).toContain('employer-documents')
  })
})

describe('bucketFor', () => {
  it('sorts into overdue / this week / next / later', () => {
    expect(bucketFor(parseDate('2026-10-04'), today, false)).toBe('overdue')
    expect(bucketFor(parseDate('2026-10-12'), today, false)).toBe('thisWeek')
    expect(bucketFor(parseDate('2026-10-19'), today, false)).toBe('next')
    expect(bucketFor(parseDate('2026-10-20'), today, false)).toBe('later')
    expect(bucketFor(parseDate('2026-10-01'), today, true)).toBe('done')
  })
})

describe('planEntitlements', () => {
  it('filters by profile', () => {
    const ids = planEntitlements(s.entitlements, student, { showDrafts: true }).map((e) => e.id)
    expect(ids).toContain('scholarships')
    expect(ids).not.toContain('recognition-advice')
  })
})

describe('residence status', () => {
  const permit = s.tasks.find((t) => t.id === 'residence-permit')!
  it('shows the permit task to people who do not hold a permit yet', () => {
    expect(applies(permit.appliesTo, { ...student, status: 'national_visa' })).toBe(true)
    expect(applies(permit.appliesTo, { ...student, status: 'not_sure' })).toBe(true)
  })
  it('hides it from people who already have a permit or have applied', () => {
    expect(applies(permit.appliesTo, { ...student, status: 'blue_card' })).toBe(false)
    expect(applies(permit.appliesTo, { ...student, status: 'fiktion' })).toBe(false)
    expect(applies(permit.appliesTo, { ...student, status: 'permanent' })).toBe(false)
  })
  it('status rules do not hide anything when no status is given', () => {
    expect(applies(permit.appliesTo, student)).toBe(true)
  })
})

describe('v3: citizenship, dates and answers', () => {
  const byId = new Map(s.tasks.map((t) => [t.id, t]))
  const israeli: Profile = { ...student, citizenship: 'best_friend', status: 'visa_free' }

  it('counts Anmeldung from the move-in date when known', () => {
    const t = byId.get('anmeldung')!
    expect(dueDate(t, student)).toEqual(parseDate('2026-10-14'))
    expect(dueDate(t, { ...student, moveIn: '2026-10-10' })).toEqual(parseDate('2026-10-23'))
  })

  it('counts the permit deadline from the visa end date when known', () => {
    const t = byId.get('residence-permit')!
    expect(dueDate(t, { ...student, visaEnd: '2026-12-31' })).toEqual(parseDate('2026-11-19'))
    expect(dueDate(t, student)).toEqual(parseDate('2026-10-15'))
  })

  it('gives § 41 nationals the 90-day permit task, not the visa one', () => {
    const ids = planTasks(s.tasks, israeli, [], { today, showDrafts: true }).map((p) => p.task.id)
    expect(ids).toContain('residence-permit-visa-free')
    expect(ids).not.toContain('residence-permit')
    expect(ids).not.toContain('tourist-visa-advice')
  })

  it('warns other tourists instead', () => {
    const ids = planTasks(s.tasks, { ...israeli, citizenship: 'other' }, [], { today, showDrafts: true }).map((p) => p.task.id)
    expect(ids).toContain('tourist-visa-advice')
    expect(ids).not.toContain('residence-permit-visa-free')
  })

  it('shows the licence swap only to non-EU drivers', () => {
    const t = byId.get('driving-licence')!
    expect(applies(t.appliesTo, { ...student, drives: 'yes' })).toBe(true)
    expect(applies(t.appliesTo, { ...student, drives: 'no' })).toBe(false)
    expect(applies(t.appliesTo, student)).toBe(false)
    expect(applies(t.appliesTo, { ...euWorker, drives: 'yes' })).toBe(false)
  })

  it('adds a housing task only while searching', () => {
    const t = byId.get('find-housing')!
    expect(applies(t.appliesTo, { ...student, housing: 'searching' })).toBe(true)
    expect(applies(t.appliesTo, { ...student, housing: 'moved_in' })).toBe(false)
  })

  it('Kindergeld appears for families with children', () => {
    const ids = (p: Profile) => planEntitlements(s.entitlements, p, { showDrafts: true }).map((e) => e.id)
    expect(ids({ ...student, household: 'children' })).toContain('kindergeld')
    expect(ids(student)).not.toContain('kindergeld')
  })

  it('milestones follow the profile', () => {
    const ids = (p: Profile) => planMilestones(s.milestones, p, { showDrafts: true }).map((m) => m.id)
    expect(ids({ ...student, status: 'blue_card' })).toContain('settlement-blue-card')
    expect(ids(euWorker)).toContain('eu-permanent-right')
    expect(ids(euWorker)).not.toContain('settlement-general')
    expect(ids(student)).toContain('naturalisation')
  })

  it('reports the day number from arrival', () => {
    const plan = planTasks(s.tasks, student, [], { today, showDrafts: true })
    expect(plan.find((p) => p.task.id === 'health-insurance')!.day).toBe(1)
  })
})
