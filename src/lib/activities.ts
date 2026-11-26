// Discover: optional things to try in Germany, by category, plus upcoming holidays by date.
// Pure functions, unit-tested.
import raw from '../content/activities.de.json'
import { addDays } from './engine'
import type { Profile, StateCode, T } from './types'

export interface Where {
  states?: StateCode[]
  cities?: string[]
}

export type Category = 'food' | 'routines' | 'fun' | 'outdoors' | 'traditions'
export const CATEGORIES: Category[] = ['food', 'routines', 'fun', 'outdoors', 'traditions']

export interface Activity {
  id: string
  category: Category
  /** inside Food & drink: a dish or a drink */
  kind?: 'food' | 'drink'
  title: T
  body: T
  /** months when it makes sense (1–12); omit = all year */
  months?: number[]
  where?: Where
  /** an alcohol-free alternative */
  alt?: T
}

export type HolidayRule = { fixed: string } | { easter: number } | { special: 'oktoberfest' | 'advent1' | 'repentance' }

export interface Holiday {
  id: string
  /** public = shops closed; tradition = no day off */
  kind: 'public' | 'tradition'
  title: T
  body: T
  rule: HolidayRule
  where?: Where
}

export const activities = raw.activities as Activity[]
export const holidays = raw.holidays as Holiday[]

/** A place rule matches if the state or the city matches; no rule = everywhere. */
export function inPlace(where: Where | undefined, p: Pick<Profile, 'state' | 'cityId'>): boolean {
  if (!where) return true
  if (where.states?.includes(p.state)) return true
  if (where.cities && p.cityId && where.cities.includes(p.cityId)) return true
  return false
}

/** Easter Sunday (Gregorian), anonymous algorithm. */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

export function holidayDate(rule: HolidayRule, year: number): Date {
  if ('fixed' in rule) {
    const [m, d] = rule.fixed.split('-').map(Number)
    return new Date(year, m - 1, d)
  }
  if ('easter' in rule) return addDays(easterSunday(year), rule.easter)
  switch (rule.special) {
    case 'oktoberfest': {
      // starts on the first Saturday after 15 September
      const d = new Date(year, 8, 16)
      while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
      return d
    }
    case 'advent1': {
      // the fourth Sunday before Christmas Day
      const d = new Date(year, 11, 24)
      while (d.getDay() !== 0) d.setDate(d.getDate() - 1)
      return addDays(d, -21)
    }
    case 'repentance': {
      // the Wednesday before 23 November
      const d = new Date(year, 10, 22)
      while (d.getDay() !== 3) d.setDate(d.getDate() - 1)
      return d
    }
  }
}

export interface DatedHoliday {
  holiday: Holiday
  date: Date
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Holidays for this person's place between today and `days` ahead, soonest first. */
export function upcomingHolidays(p: Pick<Profile, 'state' | 'cityId'>, today: Date = new Date(), days = 42): DatedHoliday[] {
  const start = dayStart(today)
  const end = addDays(start, days)
  const out: DatedHoliday[] = []
  for (let year = start.getFullYear(); year <= end.getFullYear(); year++)
    for (const holiday of holidays) {
      if (!inPlace(holiday.where, p)) continue
      const date = holidayDate(holiday.rule, year)
      if (date >= start && date <= end) out.push({ holiday, date })
    }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** Small deterministic hash, so each person gets their own but stable order. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export const MAX_PER_CATEGORY = 10

/**
 * Ideas per category for this person today: only for their place and in season, never one they removed.
 * Regional first (that's what makes it feel local), then seasonal, then the rest in the person's own stable order.
 * At most 10 per category; removing one lets the next one in.
 */
export function suggestions(
  p: Pick<Profile, 'state' | 'cityId'>,
  seed: string,
  removed: Iterable<string> = [],
  today: Date = new Date(),
): Record<Category, Activity[]> {
  const gone = new Set(removed)
  const month = today.getMonth() + 1
  const rank = (a: Activity) => (a.where ? 0 : a.months ? 1 : 2)
  const pool = activities
    .filter((a) => !gone.has(a.id) && inPlace(a.where, p) && (!a.months || a.months.includes(month)))
    .sort((a, b) => rank(a) - rank(b) || hash(seed + a.id) - hash(seed + b.id))
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, [] as Activity[]])) as Record<Category, Activity[]>
  for (const a of pool) if (out[a.category].length < MAX_PER_CATEGORY) out[a.category].push(a)
  return out
}
