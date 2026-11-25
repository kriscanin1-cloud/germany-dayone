import { describe, expect, it } from 'vitest'
import { commonGround, exampleMeetups, filterMeetups, isUpcoming } from './people'
import type { Profile } from './types'

const now = new Date(2026, 10, 25)
const me: Profile = { purpose: 'study', eu: false, arrival: '2026-11-20', state: 'DE-SN', cityId: 'leipzig', household: 'alone' }

describe('people', () => {
  const ex = exampleMeetups(now)
  it('examples are labelled, upcoming and never at a home address', () => {
    for (const m of ex) {
      expect(m.example).toBe(true)
      expect(isUpcoming(m, now)).toBe(true)
      expect(m.area.toLowerCase()).not.toMatch(/home|my place|apartment|flat/)
    }
  })
  it('in winter there is a Christmas market meetup', () => {
    expect(ex.map((m) => m.id)).toContain('ex-xmas')
  })
  it('finds common ground: same arrival month and purpose', () => {
    const coffee = ex.find((m) => m.id === 'ex-coffee')!
    const g = commonGround(me, coffee)
    expect(g.join(' ')).toMatch(/November/)
    expect(g.join(' ')).toMatch(/study/)
  })
  it('"people like me" keeps only meetups with something in common, best first', () => {
    const list = filterMeetups(ex, me, new Set(['likeMe']))
    expect(list.length).toBeGreaterThan(0)
    for (const m of list) expect(commonGround(me, m).length).toBeGreaterThan(0)
    expect(list[0].id).toBe('ex-coffee')
  })
  it('families filter shows family and everyone meetups', () => {
    const ids = filterMeetups(ex, me, new Set(['families'])).map((m) => m.id)
    expect(ids).toContain('ex-playground')
    expect(ids).not.toContain('ex-jobs')
  })
  it('language filter', () => {
    expect(filterMeetups(ex, me, new Set(), 'Arabic').map((m) => m.id)).toEqual(['ex-playground'])
  })
})
