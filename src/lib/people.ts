// People tab: meetups people propose in their city, and how well they match you.
// Fake door for now: examples + your own meetups and RSVPs stay on this device.
import { addDays } from './engine'
import type { Profile, Purpose } from './types'

export type MeetupType = 'coffee' | 'walk' | 'food' | 'language' | 'paperwork' | 'family' | 'jobs' | 'holiday' | 'other'
export type Audience = 'newcomers' | 'students' | 'jobseekers' | 'workers' | 'families' | 'everyone'
export type Rsvp = 'interested' | 'going'

export const MEETUP_TYPES: MeetupType[] = ['coffee', 'walk', 'food', 'language', 'paperwork', 'family', 'jobs', 'holiday', 'other']
export const AUDIENCES: Audience[] = ['everyone', 'newcomers', 'students', 'jobseekers', 'workers', 'families']
export const LANGUAGES = ['English', 'German', 'Russian', 'Ukrainian', 'Arabic', 'Turkish', 'Spanish', 'Hindi'] as const

export interface Meetup {
  id: string
  type: MeetupType
  title: string
  /** ISO date-time, local */
  startsAt: string
  /** district or public place type, never a home address */
  area: string
  languages: string[]
  audience: Audience[]
  maxPeople: number
  womenOnly?: boolean
  /** what the host has in common with others — coarse, never the residence status */
  host: { name: string; purpose?: Purpose; arrivalMonth?: string; household?: string }
  interested: number
  going: number
  example?: boolean
  mine?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
const isoAt = (d: Date, h: number, m = 0) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}`
const nextWeekday = (from: Date, weekday: number) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1)
  return d
}
const monthOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

/** Example meetups so the tab shows what is possible. Clearly labelled, dated relative to today. */
export function exampleMeetups(now: Date = new Date()): Meetup[] {
  const month = monthOf(now)
  const winter = [10, 11, 0].includes(now.getMonth()) // Nov, Dec, Jan
  return [
    { id: 'ex-coffee', type: 'coffee', title: `Coffee for people who arrived in ${now.toLocaleString('en-GB', { month: 'long' })}`, startsAt: isoAt(nextWeekday(now, 6), 15), area: 'City centre café', languages: ['English'], audience: ['newcomers'], maxPeople: 6, host: { name: 'Lena', purpose: 'study', arrivalMonth: month, household: 'alone' }, interested: 7, going: 3, example: true },
    winter
      ? { id: 'ex-xmas', type: 'holiday', title: 'Christmas market walk + Glühwein (or Kinderpunsch)', startsAt: isoAt(nextWeekday(now, 5), 18), area: 'Main Christmas market', languages: ['English', 'German'], audience: ['everyone'], maxPeople: 8, host: { name: 'Arjun', purpose: 'work', arrivalMonth: month }, interested: 12, going: 5, example: true }
      : { id: 'ex-biergarten', type: 'food', title: 'After-work Biergarten', startsAt: isoAt(nextWeekday(now, 4), 18), area: 'Park beer garden', languages: ['English', 'German'], audience: ['workers'], maxPeople: 8, host: { name: 'Arjun', purpose: 'work', arrivalMonth: month }, interested: 9, going: 4, example: true },
    { id: 'ex-buergeramt', type: 'paperwork', title: 'Anmeldung prep: bring your forms, we fill them in together', startsAt: isoAt(nextWeekday(now, 2), 18, 30), area: 'Public library', languages: ['English', 'Russian'], audience: ['newcomers'], maxPeople: 6, host: { name: 'Olga', purpose: 'chancenkarte', arrivalMonth: month }, interested: 5, going: 2, example: true },
    { id: 'ex-tandem', type: 'language', title: 'German–English language exchange', startsAt: isoAt(nextWeekday(now, 3), 19), area: 'Café near the university', languages: ['German', 'English'], audience: ['everyone'], maxPeople: 10, host: { name: 'Jonas', purpose: 'other' }, interested: 14, going: 6, example: true },
    { id: 'ex-playground', type: 'family', title: 'Playground meetup for new families', startsAt: isoAt(nextWeekday(now, 0), 11), area: 'Park playground', languages: ['English', 'Arabic'], audience: ['families'], maxPeople: 8, host: { name: 'Samira', purpose: 'family', household: 'children' }, interested: 4, going: 3, example: true },
    { id: 'ex-jobs', type: 'jobs', title: 'Job search Stammtisch: CVs, interviews, Opportunity Card', startsAt: isoAt(nextWeekday(now, 4), 19), area: 'Coworking space', languages: ['English'], audience: ['jobseekers'], maxPeople: 8, host: { name: 'Mehmet', purpose: 'chancenkarte', arrivalMonth: month }, interested: 8, going: 4, example: true },
  ]
}

const AUDIENCE_FOR_PURPOSE: Partial<Record<Purpose, Audience>> = { study: 'students', chancenkarte: 'jobseekers', work: 'workers' }

/** Short reasons this meetup fits the person, e.g. "arrived in November too". */
export function commonGround(p: Profile, m: Meetup): string[] {
  const out: string[] = []
  const myMonth = p.arrival.slice(0, 7)
  if (m.host.arrivalMonth === myMonth) out.push(`arrived in ${new Date(`${myMonth}-15`).toLocaleString('en-GB', { month: 'long' })} too`)
  if (m.host.purpose && m.host.purpose === p.purpose && p.purpose !== 'other') out.push(`also here to ${p.purpose === 'study' ? 'study' : p.purpose === 'work' ? 'work' : p.purpose === 'chancenkarte' ? 'find a job' : 'be with family'}`)
  if (p.household === 'children' && (m.audience.includes('families') || m.host.household === 'children')) out.push('has kids too')
  const mine = AUDIENCE_FOR_PURPOSE[p.purpose]
  if (mine && m.audience.includes(mine)) out.push(`for ${mine}`)
  const days = (Date.now() - new Date(p.arrival).getTime()) / 86_400_000
  if (m.audience.includes('newcomers') && days < 120) out.push('for newcomers')
  return [...new Set(out)]
}

export type Filter = 'likeMe' | Audience

export function filterMeetups(list: Meetup[], p: Profile, filters: Set<Filter>, language?: string): Meetup[] {
  return list
    .filter((m) => !language || m.languages.includes(language))
    .filter((m) => {
      for (const f of filters) {
        if (f === 'likeMe' && commonGround(p, m).length === 0) return false
        if (f !== 'likeMe' && !m.audience.includes(f) && !m.audience.includes('everyone')) return false
      }
      return true
    })
    .sort((a, b) => commonGround(p, b).length - commonGround(p, a).length || a.startsAt.localeCompare(b.startsAt))
}

export function isUpcoming(m: Meetup, now: Date = new Date()): boolean {
  return new Date(m.startsAt) >= addDays(now, -1)
}
