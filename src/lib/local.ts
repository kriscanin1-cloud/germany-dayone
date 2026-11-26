// Local layer: verified spots for an idea in the person's city, and day trips by regional train.
import raw from '../content/local.de.json'
import { tagsMatch } from './personalTags'
import type { Portrait } from './personal'
import type { T } from './types'

export interface Spot {
  activity: string
  city: string
  name: string
  area: string
  note: T
  url: string
  lastVerified: string
  sources: string[]
}

export interface Trip {
  id: string
  city: string
  title: T
  travel: T
  body: T
  url: string
  tags: string[]
  months?: number[]
  status: 'draft' | 'verified'
  lastVerified: string
  sources: string[]
}

export const spots = raw.spots as Spot[]
export const trips = raw.trips as Trip[]

export function spotsFor(activityId: string, cityId?: string): Spot[] {
  if (!cityId) return []
  return spots.filter((s) => s.activity === activityId && s.city === cityId).slice(0, 3)
}

/** Day trips from the person's city, in season, best interest match first. */
export function tripsFor(cityId: string | undefined, portrait: Portrait, today: Date = new Date(), showDrafts = false): Trip[] {
  if (!cityId) return []
  const month = today.getMonth() + 1
  return trips
    .filter((t) => t.city === cityId && (showDrafts || t.status === 'verified') && (!t.months || t.months.includes(month)))
    .sort((a, b) => tagsMatch(b.tags, portrait.interests) - tagsMatch(a.tags, portrait.interests))
}
