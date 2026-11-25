// Pure logic: which items apply to a profile, when they are due, in what order.
// No React in here, so it can be unit-tested.
import type { AppliesTo, Entitlement, Milestone, Profile, Task } from './types'

export type Bucket = 'overdue' | 'thisWeek' | 'next' | 'later' | 'done'

export interface PlannedTask {
  task: Task
  due: Date
  /** Day number counted from arrival (arrival = Day 1) */
  day: number
  bucket: Bucket
  done: boolean
  /** dependency ids that are not done yet */
  blockedBy: string[]
}

export function applies(rule: AppliesTo, p: Profile): boolean {
  if (rule.purposes !== 'all' && !rule.purposes.includes(p.purpose)) return false
  if (rule.euCitizen !== undefined && rule.euCitizen !== p.eu) return false
  if (rule.states && !rule.states.includes(p.state)) return false
  if (rule.cities && (!p.cityId || !rule.cities.includes(p.cityId))) return false
  if (rule.statuses && p.status && !rule.statuses.includes(p.status)) return false
  if (rule.citizenship && (!p.citizenship || !rule.citizenship.includes(p.citizenship))) return false
  if (rule.match)
    for (const [field, allowed] of Object.entries(rule.match)) {
      const v = p[field as keyof Profile]
      if (typeof v !== 'string' || !allowed!.includes(v)) return false
    }
  if (rule.anyOf && !rule.anyOf.some((r) => applies(r, p))) return false
  return true
}

/** Parse YYYY-MM-DD as a local calendar date (not UTC midnight). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(date: Date, days: number): Date {
  const r = new Date(date)
  r.setDate(r.getDate() + days)
  return r
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000)
}

export function bucketFor(due: Date, today: Date, done: boolean): Bucket {
  if (done) return 'done'
  const diff = daysBetween(today, due)
  if (diff < 0) return 'overdue'
  if (diff <= 7) return 'thisWeek'
  if (diff <= 14) return 'next'
  return 'later'
}

/** Due date of a task for a profile. Counts from the move-in date or visa end when known, else from arrival. */
export function dueDate(task: Task, p: Profile): Date {
  const { from = 'arrival', offsetDays, fallbackOffsetDays } = task.deadline
  const anchor = from === 'moveIn' ? p.moveIn : from === 'visaEnd' ? p.visaEnd : undefined
  if (anchor) return addDays(parseDate(anchor), offsetDays)
  return addDays(parseDate(p.arrival), from === 'arrival' ? offsetDays : (fallbackOffsetDays ?? offsetDays))
}

/** Dependencies first, then by `sortKey` (default: offset); stable for equal keys. Throws on cycles. */
export function orderTasks(tasks: Task[], sortKey: (t: Task) => number = (t) => t.deadline.offsetDays): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const sorted = [...tasks].sort((a, b) => sortKey(a) - sortKey(b))
  const out: Task[] = []
  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (t: Task) => {
    const s = state.get(t.id)
    if (s === 'done') return
    if (s === 'visiting') throw new Error(`Dependency cycle at "${t.id}"`)
    state.set(t.id, 'visiting')
    for (const dep of t.dependsOn) {
      const d = byId.get(dep)
      if (d) visit(d) // dependencies outside the filtered set are ignored
    }
    state.set(t.id, 'done')
    out.push(t)
  }
  sorted.forEach(visit)
  return out
}

export interface PlanOptions {
  today?: Date
  showDrafts?: boolean
}

export function planTasks(
  tasks: Task[],
  profile: Profile,
  doneIds: Iterable<string>,
  { today = new Date(), showDrafts = false }: PlanOptions = {},
): PlannedTask[] {
  const done = new Set(doneIds)
  const arrival = parseDate(profile.arrival)
  const visible = tasks.filter((t) => (showDrafts || t.status === 'verified') && applies(t.appliesTo, profile))
  const visibleIds = new Set(visible.map((t) => t.id))
  const dues = new Map(visible.map((t) => [t.id, dueDate(t, profile)]))
  return orderTasks(visible, (t) => dues.get(t.id)!.getTime()).map((task) => {
    const due = dues.get(task.id)!
    const isDone = done.has(task.id)
    return {
      task,
      due,
      day: daysBetween(arrival, due) + 1,
      done: isDone,
      bucket: bucketFor(due, today, isDone),
      blockedBy: task.dependsOn.filter((d) => visibleIds.has(d) && !done.has(d)),
    }
  })
}

export function planEntitlements(
  items: Entitlement[],
  profile: Profile,
  { showDrafts = false }: PlanOptions = {},
): Entitlement[] {
  return items.filter((e) => (showDrafts || e.status === 'verified') && applies(e.appliesTo, profile))
}

export function planMilestones(
  items: Milestone[],
  profile: Profile,
  { showDrafts = false }: PlanOptions = {},
): Milestone[] {
  return items.filter((m) => (showDrafts || m.status === 'verified') && applies(m.appliesTo, profile))
}
