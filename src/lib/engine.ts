// Pure logic: which items apply to a profile, when they are due, in what order.
// No React in here, so it can be unit-tested.
import type { AppliesTo, Entitlement, Profile, Task } from './types'

export type Bucket = 'overdue' | 'thisWeek' | 'next' | 'later' | 'done'

export interface PlannedTask {
  task: Task
  due: Date
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

function daysBetween(a: Date, b: Date): number {
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

/** Dependencies first, then by due date; stable for equal dates. Throws on cycles. */
export function orderTasks(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const sorted = [...tasks].sort((a, b) => a.deadline.offsetDays - b.deadline.offsetDays)
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
  return orderTasks(visible).map((task) => {
    const due = addDays(arrival, task.deadline.offsetDays)
    const isDone = done.has(task.id)
    return {
      task,
      due,
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
