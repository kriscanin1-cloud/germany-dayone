import { describe, expect, it } from 'vitest'
import { activities, suggestions } from './activities'
import { spots, spotsFor, trips, tripsFor } from './local'
import { allowed, score } from './personal'
import places from '../content/places.de.json'
import type { StateCode } from './types'

const nov = new Date(2026, 10, 26)
const at = (cityId: string, state: string) => ({ state: state as StateCode, cityId })
const ids = (r: ReturnType<typeof suggestions>) => Object.values(r).flat().map((x) => x.activity.id)

describe('portrait filters', () => {
  it('vegetarians get no meat or fish; halal/no-pork get no pork', () => {
    const veg = ids(suggestions(at('muenchen', 'DE-BY'), 's', [], nov, { taste: { diet: 'vegetarian' } }))
    expect(veg).not.toContain('weisswurst')
    expect(veg).not.toContain('currywurst')
    const halal = ids(suggestions(at('berlin', 'DE-BE'), 's', [], nov, { taste: { diet: 'halal' } }))
    expect(halal).not.toContain('currywurst')
  })
  it('no alcohol hides drinks that are alcohol, keeps beer gardens and Christmas markets', () => {
    const r = ids(suggestions(at('koeln', 'DE-NW'), 's', [], nov, { taste: { alcohol: 'no' } }))
    expect(r).not.toContain('koelsch')
    expect(r).toContain('gluehwein') // optional: has a Kinderpunsch alternative
    expect(allowed({ alcohol: 'core' }, { diet: 'halal' })).toBe(false)
  })
})

describe('local layer', () => {
  it('a Köln person sees Kölsch first with a reason; a Dresden person never sees it', () => {
    const k = suggestions(at('koeln', 'DE-NW'), 's', [], nov, {}, 'Köln')
    expect(k.food[0].activity.id).toBe('koelsch')
    expect(k.food[0].reasons[0]).toEqual({ key: 'why.city', vars: { place: 'Köln' } })
    expect(ids(suggestions(at('dresden', 'DE-SN'), 's', [], nov))).not.toContain('koelsch')
  })
  it('interests and kids lift matching ideas', () => {
    const a = activities.find((x) => x.id === 'rodeln')!
    const base = score(a, at('berlin', 'DE-BE'), {}).score
    expect(score(a, at('berlin', 'DE-BE'), { interests: ['Sports'], taste: { company: 'kids' } }).score).toBeGreaterThan(base)
  })
  it('tried ideas sink', () => {
    const a = activities.find((x) => x.id === 'brezel')!
    expect(score(a, at('berlin', 'DE-BE'), { tried: ['brezel'] }).score).toBeLessThan(score(a, at('berlin', 'DE-BE'), {}).score)
  })
  it('spots and trips point at real cities and ideas, verified ones have sources', () => {
    const cityIds = new Set(places.cities.map((c) => c.id))
    const ideaIds = new Set(activities.map((a) => a.id))
    for (const s of spots) {
      expect(cityIds.has(s.city)).toBe(true)
      expect(ideaIds.has(s.activity)).toBe(true)
      expect(s.url.startsWith('https://')).toBe(true)
    }
    for (const t of trips) {
      expect(cityIds.has(t.city)).toBe(true)
      if (t.status === 'verified') expect(t.sources.length).toBeGreaterThan(0)
    }
    expect(spotsFor('koelsch', 'koeln').length).toBeGreaterThan(0)
    expect(spotsFor('koelsch', 'dresden')).toEqual([])
  })
  it('each pilot city has day trips; Dresden suggests Leipzig', () => {
    for (const c of ['dresden', 'leipzig', 'koeln', 'duesseldorf', 'muenchen', 'berlin'])
      expect(tripsFor(c, {}, nov, true).length).toBeGreaterThanOrEqual(1)
    expect(tripsFor('dresden', {}, nov).map((t) => t.id)).toContain('dd-leipzig')
    expect(tripsFor('muenchen', {}, nov).map((t) => t.id)).not.toContain('m-fuenfseen') // summer only
  })
})
