// The person's "portrait" for Discover: taste answers + interests + household + what they tried.
// Everything here stays on the device. Diet and alcohol answers can hint at religion (GDPR Art. 9),
// so they are never sent anywhere — not in analytics, not in research answers.
import type { Activity } from './activities'
import type { Profile } from './types'

export type Diet = 'all' | 'vegetarian' | 'vegan' | 'halal' | 'no_pork'
export interface Taste {
  diet?: Diet
  alcohol?: 'yes' | 'no'
  company?: 'alone' | 'partner' | 'kids'
  pace?: 'calm' | 'mixed' | 'active'
  budget?: 'free' | 'low' | 'any'
}

/** Interests as shown in Me and in the survey → the tag used on ideas. */
export const INTERESTS = {
  'Food & cooking': 'food',
  'Hiking & nature': 'nature',
  Sports: 'sport',
  'Board games': 'games',
  Music: 'music',
  'Art & museums': 'culture',
  Films: 'films',
  Tech: 'tech',
  Books: 'books',
  Parenting: 'kids',
  'Language practice': 'language',
  Nightlife: 'nightlife',
  Volunteering: 'community',
  Photography: 'photo',
} as const
export type InterestLabel = keyof typeof INTERESTS
export const INTEREST_LABELS = Object.keys(INTERESTS) as InterestLabel[]

export interface Portrait {
  taste?: Taste
  interests?: string[]
  household?: string
  tried?: string[]
}

export interface Reason {
  key: string
  vars?: Record<string, string>
}

/** Hard filters: things the person said they don't eat or drink are not suggested at all. */
export function allowed(a: Pick<Activity, 'alcohol' | 'contains'>, taste: Taste = {}): boolean {
  const c = a.contains ?? []
  if ((taste.diet === 'vegetarian' || taste.diet === 'vegan') && (c.includes('meat') || c.includes('fish'))) return false
  if ((taste.diet === 'halal' || taste.diet === 'no_pork') && c.includes('pork')) return false
  if ((taste.alcohol === 'no' || taste.diet === 'halal') && a.alcohol === 'core') return false
  return true
}

const tagsOfInterests = (interests: string[] = []) =>
  new Set(interests.map((i) => INTERESTS[i as InterestLabel]).filter(Boolean) as string[])

/**
 * How well an idea fits this person, and why. Higher is better.
 * Local and seasonal ideas lead (that's what makes the app feel like *your* Germany),
 * then interests, company, pace and budget; things already tried sink to the end.
 */
export function score(
  a: Activity,
  p: Pick<Profile, 'state' | 'cityId'>,
  portrait: Portrait,
  placeName?: string,
): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = []
  let s = 0
  if (a.where?.cities && p.cityId && a.where.cities.includes(p.cityId)) {
    s += 4
    reasons.push({ key: 'why.city', vars: { place: placeName ?? '' } })
  } else if (a.where?.states?.includes(p.state)) {
    s += 3
    reasons.push({ key: 'why.region' })
  }
  if (a.months) {
    s += 2
    reasons.push({ key: 'why.season' })
  }
  const mine = tagsOfInterests(portrait.interests)
  const matched = (a.tags ?? []).filter((t) => mine.has(t))
  if (matched.length) {
    s += Math.min(2 * matched.length, 4)
    const label = INTEREST_LABELS.find((l) => INTERESTS[l] === matched[0])
    if (label) reasons.push({ key: 'why.interest', vars: { interest: label.toLowerCase() } })
  }
  const kids = portrait.taste?.company === 'kids' || portrait.household === 'children'
  if (kids && a.tags?.includes('kids')) {
    s += 2
    reasons.push({ key: 'why.kids' })
  }
  const pace = portrait.taste?.pace
  if (pace && pace !== 'mixed' && a.pace === pace) s += 1
  const budget = portrait.taste?.budget
  if (budget === 'free' && a.cost === 'free') {
    s += 1
    reasons.push({ key: 'why.free' })
  }
  if (budget === 'free' && a.cost === 'paid') s -= 2
  if (portrait.taste?.alcohol === 'no' && a.alcohol === 'optional') reasons.push({ key: 'why.alcoholFree' })
  if (portrait.tried?.includes(a.id)) s -= 6
  return { score: s, reasons: reasons.slice(0, 2) }
}
