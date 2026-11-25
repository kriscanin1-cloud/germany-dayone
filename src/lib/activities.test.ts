import { describe, expect, it } from 'vitest'
import places from '../content/places.de.json'
import { activities, activitiesByWeek, easterSunday, holidayDate, holidays, holidaysInWeeks, PER_WEEK, weekOfDay } from './activities'
import type { Profile } from './types'

const berlin: Profile = { purpose: 'study', eu: false, arrival: '2026-11-25', state: 'DE-BE', cityId: 'berlin' }
const munich: Profile = { purpose: 'work', eu: true, arrival: '2027-09-10', state: 'DE-BY', cityId: 'muenchen' }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('content', () => {
  it('ids are unique and places are real', () => {
    const ids = [...activities, ...holidays].map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    const cities = new Set(places.cities.map((c) => c.id))
    const states = new Set(places.states.map((s) => s.code))
    for (const x of [...activities, ...holidays]) {
      for (const c of x.where?.cities ?? []) expect(cities.has(c), `${x.id}: ${c}`).toBe(true)
      for (const s of x.where?.states ?? []) expect(states.has(s), `${x.id}: ${s}`).toBe(true)
    }
  })
  it('every alcoholic drink offers an alternative', () => {
    for (const a of activities.filter((x) => x.kind === 'drink' && /beer|wine|Kölsch|Altbier|Weiß|Apfelwein|Glühwein|Radler|Biergarten|Federweißer/i.test(x.title.en)))
      expect(a.alt, a.id).toBeDefined()
  })
})

describe('dates', () => {
  it('computes Easter', () => {
    expect(iso(easterSunday(2026))).toBe('2026-04-05')
    expect(iso(easterSunday(2027))).toBe('2027-03-28')
  })
  it('computes moving holidays', () => {
    expect(iso(holidayDate({ special: 'oktoberfest' }, 2026))).toBe('2026-09-19')
    expect(iso(holidayDate({ special: 'oktoberfest' }, 2025))).toBe('2025-09-20')
    expect(iso(holidayDate({ special: 'advent1' }, 2026))).toBe('2026-11-29')
    expect(iso(holidayDate({ special: 'repentance' }, 2026))).toBe('2026-11-18')
    expect(iso(holidayDate({ easter: -48 }, 2027))).toBe('2027-02-08') // Rosenmontag
  })
  it('counts weeks from arrival', () => {
    expect([1, 7, 8, 14, 15].map(weekOfDay)).toEqual([1, 1, 2, 2, 3])
  })
})

describe('holidaysInWeeks', () => {
  it('puts holidays in the right week and respects the state', () => {
    const h = holidaysInWeeks(berlin, 1, 8)
    const ids = h.map((x) => x.holiday.id)
    expect(ids).toContain('advent-1') // 29 Nov 2026, week 1
    expect(h.find((x) => x.holiday.id === 'advent-1')!.week).toBe(1)
    expect(ids).toContain('christmas')
    expect(ids).toContain('new-year') // crosses into 2027
    expect(ids).not.toContain('epiphany') // not a holiday in Berlin
  })
  it('shows Oktoberfest only in Munich', () => {
    expect(holidaysInWeeks(munich, 1, 4).map((x) => x.holiday.id)).toContain('oktoberfest')
    expect(holidaysInWeeks({ ...berlin, arrival: '2027-09-10' }, 1, 4).map((x) => x.holiday.id)).not.toContain('oktoberfest')
  })
})

describe('activitiesByWeek', () => {
  it('gives three per week, never repeats, and is stable per person', () => {
    const a = activitiesByWeek(berlin, 'seed-1', 1, 8)
    const all = [...a.values()].flat().map((x) => x.id)
    for (const w of a.values()) expect(w).toHaveLength(PER_WEEK)
    expect(new Set(all).size).toBe(all.length)
    expect([...activitiesByWeek(berlin, 'seed-1', 1, 8).values()].flat().map((x) => x.id)).toEqual(all)
  })
  it('only picks things for this place and season', () => {
    const all = [...activitiesByWeek(berlin, 's', 1, 6).values()].flat()
    expect(all.some((x) => x.id === 'weisswurst')).toBe(false)
    expect(all.some((x) => x.id === 'spargel')).toBe(false) // November–January: no asparagus
    const winter = activitiesByWeek(berlin, 's', 1, 2).get(1)!
    expect(winter.some((x) => x.where || x.months)).toBe(true) // regional or seasonal first
  })
  it('replaces a removed activity', () => {
    const before = activitiesByWeek(berlin, 's', 1, 1).get(1)!
    const after = activitiesByWeek(berlin, 's', 1, 1, [before[0].id]).get(1)!
    expect(after).toHaveLength(PER_WEEK)
    expect(after.map((x) => x.id)).not.toContain(before[0].id)
  })
  it('mixes kinds within a week', () => {
    for (const w of activitiesByWeek(berlin, 'x', 1, 6).values()) expect(new Set(w.map((x) => x.kind)).size).toBeGreaterThan(1)
  })
})
