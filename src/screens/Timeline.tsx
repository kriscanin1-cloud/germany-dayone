import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { activitiesByWeek, holidaysInWeeks, type Activity, type DatedHoliday } from '../lib/activities'
import { track } from '../lib/analytics'
import { scenario, SHOW_DRAFTS } from '../lib/content'
import { daysBetween, parseDate, planMilestones, planTasks, type PlannedTask } from '../lib/engine'
import { t } from '../lib/i18n'
import { toProfile } from '../lib/questionnaire'
import { update, type Saved } from '../lib/storage'
import { useDone } from '../lib/useDone'
import type { Profile } from '../lib/types'

// Until onboarding is done, the timeline previews a sample profile.
const SAMPLE: Profile = {
  purpose: 'study', eu: false, citizenship: 'other', status: 'national_visa',
  arrival: isoDaysAgo(4), state: 'DE-BE', cityId: 'berlin',
}

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Weeks 1–8 are shown one by one; anything later is listed by month. */
const WEEKS_SHOWN = 8
const fmtHoliday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export function Timeline() {
  const { saved, setSaved, ask, asking, confirm, close } = useDone()
  // profiles saved before questionnaire v3 have no citizenship: rebuild them from the saved answers
  const profile =
    saved.profile && !saved.profile.citizenship && saved.answers ? toProfile(saved.answers) : (saved.profile ?? SAMPLE)

  const plan = useMemo(
    () => planTasks(scenario.tasks, profile, saved.done, { showDrafts: SHOW_DRAFTS }),
    [profile, saved.done],
  )
  const milestones = useMemo(
    () => planMilestones(scenario.milestones ?? [], profile, { showDrafts: SHOW_DRAFTS }),
    [profile],
  )
  const titles = useMemo(() => new Map(scenario.tasks.map((x) => [x.id, x.title.en])), [])

  const currentDay = Math.max(1, daysBetween(parseDate(profile.arrival), new Date()) + 1)
  const currentWeek = Math.ceil(currentDay / 7)
  const lastWeek = Math.max(WEEKS_SHOWN, currentWeek + 1)
  const weeks = Array.from({ length: lastWeek }, (_, i) => i + 1)

  const fun = useMemo(
    () => activitiesByWeek(profile, saved.anonId, currentWeek, lastWeek, saved.removed),
    [profile, saved.anonId, currentWeek, lastWeek, saved.removed],
  )
  const hols = useMemo(() => holidaysInWeeks(profile, currentWeek, lastWeek), [profile, currentWeek, lastWeek])

  const later = plan.filter((p) => p.week > lastWeek)
  const doneCount = plan.filter((p) => p.done).length
  const tried = new Set(saved.tried ?? [])

  const persist = (change: (s: Saved) => Saved) => setSaved(update(change))
  const toggleTried = (id: string) =>
    persist((s) => {
      const cur = s.tried ?? []
      return { ...s, tried: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }
    })
  const remove = (id: string) => persist((s) => ({ ...s, removed: [...new Set([...(s.removed ?? []), id])] }))

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-sign text-[32px] leading-none font-bold">{t('timeline.title')}</h1>
        <p className="shrink-0 rounded-md bg-sign px-2.5 py-1 font-sign text-lg leading-none font-bold">
          {t('week.n', { n: String(currentWeek) })}
        </p>
      </div>
      {!saved.profile && (
        <div className="mt-3">
          <p className="text-muted">{t('timeline.sample')}</p>
          <Link to="/onboarding" className="mt-3 inline-block rounded-md bg-ink px-4 py-2.5 font-semibold text-paper">
            {t('timeline.cta')}
          </Link>
        </div>
      )}

      <div className="mt-5">
        <p className="text-sm text-muted">{t('timeline.progress', { done: String(doneCount), total: String(plan.length) })}</p>
        <div className="mt-1.5 h-2 bg-concrete">
          <div className="h-2 bg-ink" style={{ width: `${plan.length ? (doneCount / plan.length) * 100 : 0}%` }} />
        </div>
      </div>

      {weeks.map((week) => {
        const tasks = plan.filter((p) => p.week === week)
        const isPast = week < currentWeek
        const open = tasks.filter((p) => !p.done)
        const acts = fun.get(week) ?? []
        const weekHols = hols.filter((h) => h.week === week)
        if (!tasks.length && !acts.length && !weekHols.length) return null
        return (
          <div key={week} className="mt-8">
            <h2 className="flex items-baseline justify-between border-b-2 border-ink pb-1.5">
              <span className="font-sign text-2xl font-bold">{t('week.n', { n: String(week) })}</span>
              {week === currentWeek && <span className="bg-sign px-2 py-0.5 text-sm font-semibold">{t('week.this')}</span>}
              {isPast && open.length > 0 && <span className="text-sm font-semibold">{t('week.stillOpen')}</span>}
              {tasks.length > 0 && open.length === 0 && <span className="text-sm font-semibold">{t('week.allDone')}</span>}
              {week === currentWeek + 1 && <span className="text-sm text-muted">{t('week.next')}</span>}
            </h2>
            {tasks.length > 0 && (
              <ol>
                {tasks.map((p) => (
                  <TaskRow key={p.task.id} p={p} titles={titles} onToggle={() => ask(p.task.id, p.task.title.en)} />
                ))}
              </ol>
            )}
            {(acts.length > 0 || weekHols.length > 0) && !isPast && (
              <div className="mt-4">
                <p className="text-sm font-semibold">{t('fun.title')}</p>
                <ul className="mt-2 space-y-2">
                  {weekHols.map((h) => (
                    <HolidayCard key={h.holiday.id + h.date.getFullYear()} h={h} />
                  ))}
                  {acts.map((a) => (
                    <ActivityCard
                      key={a.id}
                      a={a}
                      tried={tried.has(a.id)}
                      onTried={() => toggleTried(a.id)}
                      onRemove={() => remove(a.id)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      })}

      {later.length > 0 && (
        <div className="mt-8">
          <h2 className="border-b-2 border-ink pb-1.5 font-sign text-2xl font-bold">{t('week.later')}</h2>
          <ol>
            {later.map((p) => (
              <TaskRow
                key={p.task.id}
                p={p}
                titles={titles}
                label={t('month.n', { n: String(Math.ceil(p.day / 30)) })}
                onToggle={() => ask(p.task.id, p.task.title.en)}
              />
            ))}
          </ol>
        </div>
      )}

      {plan.length === 0 && (
        <p className="mt-8 border-l-4 border-sign pl-3 text-muted">{t('timeline.empty')}</p>
      )}

      {milestones.length > 0 && (
        <div className="mt-10">
          <h2 className="border-b-2 border-ink pb-1.5 font-sign text-2xl font-bold">{t('timeline.ahead')}</h2>
          <ol>
            {milestones.map((m) => (
              <li key={m.id} className="border-b border-ink/15 py-3.5">
                <p className="text-sm font-semibold">{m.when.en}</p>
                <p className="mt-0.5 text-[17px] leading-snug font-semibold">{m.title.en}</p>
                <p className="mt-1 text-sm text-muted">
                  {m.summary.en}{' '}
                  {m.status === 'draft' && <span className="bg-sign-soft px-1">{t('draft.badge')}</span>}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <DoneDialog asking={asking} confirm={confirm} close={close} />
    </section>
  )
}

export function DoneDialog({
  asking,
  confirm,
  close,
}: {
  asking: { title: string; done: boolean } | null
  confirm: () => void
  close: () => void
}) {
  return (
    <ConfirmDialog
      open={Boolean(asking)}
      title={asking?.done ? t('done.undoTitle') : t('done.askTitle')}
      body={asking?.title}
      yes={asking?.done ? t('done.undoYes') : t('done.yes')}
      no={asking?.done ? t('done.undoNo') : t('done.no')}
      onYes={confirm}
      onClose={close}
    />
  )
}

function TaskRow({
  p,
  titles,
  label,
  onToggle,
}: {
  p: PlannedTask
  titles: Map<string, string>
  label?: string
  onToggle: () => void
}) {
  const { task, done, blockedBy } = p
  return (
    <li className="flex gap-3 border-b border-ink/15 py-3.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={t('task.markDone', { title: task.title.en })}
        onClick={onToggle}
        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink text-sm font-bold ${
          done ? 'bg-ink text-sign' : ''
        }`}
      >
        {done ? '✓' : ''}
      </button>
      <div className="min-w-0">
        {label && <p className="text-sm font-semibold">{label}</p>}
        <Link
          to={`/task/${task.id}`}
          className={`block text-[17px] leading-snug font-semibold ${done ? 'text-muted line-through' : ''}`}
        >
          {task.title.en} <span aria-hidden className="text-muted no-underline">›</span>
        </Link>
        {!done && (
          <p className="mt-1 text-sm text-muted">
            {task.deadline.hard && <span className="font-semibold text-alert">{t('task.legal')} </span>}
            {blockedBy.length > 0 && (
              <span>{t('task.first', { list: blockedBy.map((id) => titles.get(id) ?? id).join('; ') })} </span>
            )}
            {task.status === 'draft' && <span className="bg-sign-soft px-1">{t('draft.badge')}</span>}
          </p>
        )}
      </div>
    </li>
  )
}

const kindLabel = { food: 'fun.food', drink: 'fun.drink', culture: 'fun.culture' } as const

function ActivityCard({
  a,
  tried,
  onTried,
  onRemove,
}: {
  a: Activity
  tried: boolean
  onTried: () => void
  onRemove: () => void
}) {
  return (
    <li className={`relative rounded-md border-2 p-3.5 pr-11 ${tried ? 'border-ink bg-sign' : 'border-ink/20'}`}>
      <p className="text-xs font-semibold text-muted">{t(kindLabel[a.kind])}</p>
      <p className="mt-0.5 font-semibold">{a.title.en}</p>
      <p className="mt-1 text-sm">{a.body.en}</p>
      {a.alt && <p className="mt-1 text-sm text-muted">{a.alt.en}</p>}
      <button
        type="button"
        role="checkbox"
        aria-checked={tried}
        onClick={onTried}
        className="mt-2.5 rounded-md border-2 border-ink px-3 py-1 text-sm font-semibold"
      >
        {tried ? t('fun.tried') : t('fun.try')}
      </button>
      <Link
        to={`/people/new?activity=${a.id}`}
        onClick={() => track('meetup_create_opened', { from: 'activity', activity: a.id })}
        className="mt-2.5 ml-2 inline-block rounded-md px-2 py-1 text-sm font-semibold underline"
      >
        {t('fun.together')}
      </Link>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('fun.remove', { title: a.title.en })}
        className="absolute top-1.5 right-1.5 grid h-9 w-9 place-items-center rounded-md text-xl leading-none text-muted"
      >
        ×
      </button>
    </li>
  )
}

function HolidayCard({ h }: { h: DatedHoliday }) {
  const pub = h.holiday.kind === 'public'
  return (
    <li className={`rounded-md border-2 p-3.5 ${pub ? 'border-ink bg-ink text-paper' : 'border-ink bg-sign-soft'}`}>
      <p className={`text-xs font-semibold ${pub ? 'text-sign' : 'text-muted'}`}>
        {fmtHoliday.format(h.date)} · {t(pub ? 'fun.public' : 'fun.tradition')}
      </p>
      <p className="mt-0.5 font-semibold">{h.holiday.title.en}</p>
      <p className="mt-1 text-sm">{h.holiday.body.en}</p>
    </li>
  )
}
