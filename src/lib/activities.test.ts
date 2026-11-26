import { describe, expect, it } from 'vitest'
import places from '../content/places.de.json'
import { activities, CATEGORIES, easterSunday, holidayDate, holidays, MAX_PER_CATEGORY, suggestions, upcomingHolidays } from './activities'
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
  it('every idea has a known category', () => {
    for (const a of activities) expect(CATEGORIES, a.id).toContain(a.category)
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
})

const nov25 = new Date(2026, 10, 25)

describe('upcomingHolidays', () => {
  it('lists holidays for the place, soonest first, across the new year', () => {
    const h = upcomingHolidays(berlin, nov25, 42)
    const ids = h.map((x) => x.holiday.id)
    expect(ids[0]).toBe('advent-1') // 29 Nov 2026
    expect(ids).toContain('christmas')
    expect(ids).toContain('new-year') // 1 Jan 2027
    expect(ids).not.toContain('epiphany') // not a holiday in Berlin
    for (let i = 1; i < h.length; i++) expect(h[i].date >= h[i - 1].date).toBe(true)
  })
  it('shows Oktoberfest only in Munich', () => {
    const sep = new Date(2027, 8, 10)
    expect(upcomingHolidays(munich, sep, 30).map((x) => x.holiday.id)).toContain('oktoberfest')
    expect(upcomingHolidays(berlin, sep, 30).map((x) => x.holiday.id)).not.toContain('oktoberfest')
  })
})

describe('suggestions by category', () => {
  it('has 5 to 10 ideas in every category, every month, anywhere', () => {
    for (const place of [berlin, munich, { ...berlin, state: 'DE-SL' as const, cityId: undefined }])
      for (let m = 0; m < 12; m++) {
        const s = suggestions(place, 'seed', [], new Date(2027, m, 15))
        for (const c of CATEGORIES) {
          expect(s[c].length, `${place.state} month ${m + 1} ${c}`).toBeGreaterThanOrEqual(5)
          expect(s[c].length).toBeLessThanOrEqual(MAX_PER_CATEGORY)
        }
      }
  })
  it('is stable per person and never repeats', () => {
    const a = suggestions(berlin, 'seed-1', [], nov25)
    expect(suggestions(berlin, 'seed-1', [], nov25)).toEqual(a)
    const ids = Object.values(a).flat().map((x) => x.activity.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('only picks things for this place and season, local first', () => {
    const s = suggestions(berlin, 's', [], nov25)
    const all = Object.values(s).flat().map((x) => x.activity.id)
    expect(all).not.toContain('weisswurst')
    expect(all).not.toContain('spargel')
    expect(all).toContain('gluehwein')
    expect(s.food[0].activity.where).toBeDefined() // Berliner Weiße or similar comes first
    expect(suggestions(munich, 's', [], nov25).food.map((x) => x.activity.id)).toContain('weisswurst')
  })
  it('a removed idea is replaced by the next one', () => {
    const before = suggestions(berlin, 's', [], nov25).food
    const after = suggestions(berlin, 's', [before[0].activity.id], nov25).food
    expect(after.map((x) => x.activity.id)).not.toContain(before[0].activity.id)
    expect(after).toHaveLength(before.length)
  })
})
