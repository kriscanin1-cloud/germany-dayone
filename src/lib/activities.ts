// "Taste of Germany": three optional things to try each week, plus holidays that fall in that week.
// Pure functions, unit-tested.
import raw from '../content/activities.de.json'
import { addDays, daysBetween, parseDate } from './engine'
import type { Profile, StateCode, T } from './types'

export interface Where {
  states?: StateCode[]
  cities?: string[]
}

export interface Activity {
  id: string
  kind: 'food' | 'drink' | 'culture'
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

/** Week number counted from arrival: days 1–7 are week 1. */
export function weekOfDay(day: number): number {
  return Math.max(1, Math.ceil(day / 7))
}

export interface DatedHoliday {
  holiday: Holiday
  date: Date
  week: number
}

/** Holidays for this person's place that fall in weeks `from`..`to`. */
export function holidaysInWeeks(p: Profile, from: number, to: number): DatedHoliday[] {
  const arrival = parseDate(p.arrival)
  const start = addDays(arrival, (from - 1) * 7)
  const end = addDays(arrival, to * 7 - 1)
  const out: DatedHoliday[] = []
  for (let year = start.getFullYear(); year <= end.getFullYear(); year++)
    for (const holiday of holidays) {
      if (!inPlace(holiday.where, p)) continue
      const date = holidayDate(holiday.rule, year)
      if (date < start || date > end) continue
      out.push({ holiday, date, week: weekOfDay(daysBetween(arrival, date) + 1) })
    }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** Small deterministic hash, so each person gets their own but stable order. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export const PER_WEEK = 3

/**
 * Three activities per week from `from` to `to`. Each activity appears at most once,
 * regional ones first, only in season, never one the person removed.
 * Ticked ones stay in the week where they were shown.
 */
export function activitiesByWeek(
  p: Profile,
  seed: string,
  from: number,
  to: number,
  removed: Iterable<string> = [],
): Map<number, Activity[]> {
  const gone = new Set(removed)
  const arrival = parseDate(p.arrival)
  const pool = activities
    .filter((a) => !gone.has(a.id) && inPlace(a.where, p))
    .sort((a, b) => Number(!a.where) - Number(!b.where) || hash(seed + a.id) - hash(seed + b.id))
  const used = new Set<string>()
  const out = new Map<number, Activity[]>()
  for (let week = 1; week <= to; week++) {
    const month = addDays(arrival, (week - 1) * 7 + 3).getMonth() + 1
    const picks: Activity[] = []
    // seasonal and regional first, so they are not missed; then the rest in the person's own order
    const candidates = pool.filter((a) => !used.has(a.id) && (!a.months || a.months.includes(month)))
    const ranked = [...candidates.filter((a) => a.months || a.where), ...candidates.filter((a) => !a.months && !a.where)]
    // mix kinds: prefer one food, one drink or culture, one of anything
    for (const a of ranked) {
      if (picks.length === PER_WEEK) break
      if (picks.some((x) => x.kind === a.kind) && ranked.some((b) => !used.has(b.id) && !picks.includes(b) && !picks.some((x) => x.kind === b.kind))) continue
      picks.push(a)
    }
    for (const a of ranked) if (picks.length < PER_WEEK && !picks.includes(a)) picks.push(a)
    picks.forEach((a) => used.add(a.id))
    if (week >= from) out.set(week, picks)
  }
  return out
}
