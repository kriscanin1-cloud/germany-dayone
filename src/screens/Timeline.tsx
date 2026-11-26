import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CATEGORIES, suggestions, upcomingHolidays, type Category, type DatedHoliday, type Suggestion } from '../lib/activities'
import { track } from '../lib/analytics'
import { cities, scenario, SHOW_DRAFTS } from '../lib/content'
import { spotsFor, tripsFor, type Spot, type Trip } from '../lib/local'
import type { Portrait } from '../lib/personal'
import { safeUrl } from '../lib/url'
import { countdown, humanDays } from '../lib/dates'
import { daysBetween, parseDate, planMilestones, planTasks, type PlannedTask } from '../lib/engine'
import { t, type Key } from '../lib/i18n'
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

  const cityName = cities.find((c) => c.id === profile.cityId)?.name
  // the person's portrait: taste survey + interests + household + what they already tried (device only)
  const portrait: Portrait = useMemo(
    () => ({ taste: saved.taste, interests: saved.me?.interests, household: profile.household, tried: saved.tried }),
    [saved.taste, saved.me?.interests, profile.household, saved.tried],
  )
  const fun = useMemo(
    () => suggestions(profile, saved.anonId, saved.removed, new Date(), portrait, cityName),
    [profile, saved.anonId, saved.removed, portrait, cityName],
  )
  const dayTrips = useMemo(() => tripsFor(profile.cityId, portrait, new Date(), SHOW_DRAFTS).slice(0, 3), [profile.cityId, portrait])
  const personalised = Boolean(saved.taste && Object.values(saved.taste).some(Boolean))
  const hols = useMemo(() => upcomingHolidays(profile).slice(0, 4), [profile])

  const later = plan.filter((p) => p.week > lastWeek)
  const doneCount = plan.filter((p) => p.done).length
  const tried = new Set(saved.tried ?? [])

  // two views: what you must do, and what you can discover; kept in the URL so Back returns to the same view
  const [params, setParams] = useSearchParams()
  const view: 'todo' | 'discover' = params.get('view') === 'discover' ? 'discover' : 'todo'
  const openTasks = plan.filter((p) => !p.done && p.week <= currentWeek).length
  const cat: Category = CATEGORIES.find((c) => c === params.get('cat')) ?? 'food'

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
      {saved.profile &&
        [
          { key: 'visa', iso: profile.visaEnd, label: t('me.visaEnd'), advice: t('me.visaAdvice') },
          { key: 'passport', iso: saved.me?.passportEnd, label: t('me.passportEnd'), advice: t('me.passportAdvice') },
        ]
          .filter((d) => d.iso && countdown(d.iso).urgency !== 'ok')
          .map((d) => {
            const c = countdown(d.iso!)
            return (
              <Link key={d.key} to="/me" className={`mt-4 block rounded-md border-2 p-3 ${c.urgency === 'soon' ? 'border-ink bg-sign-soft' : 'border-alert'}`}>
                <p className={`font-semibold ${c.urgency === 'soon' ? '' : 'text-alert'}`}>
                  {d.label}: {humanDays(c.days)}
                </p>
                <p className="mt-0.5 text-sm">{d.advice}</p>
              </Link>
            )
          })}
      {!saved.profile && (
        <div className="mt-3">
          <p className="text-muted">{t('timeline.sample')}</p>
          <Link to="/onboarding" className="mt-3 inline-block rounded-md bg-ink px-4 py-2.5 font-semibold text-paper">
            {t('timeline.cta')}
          </Link>
        </div>
      )}

      <div role="tablist" aria-label={t('timeline.title')} className="mt-5 grid grid-cols-2 rounded-md border-2 border-ink p-1">
        {(['todo', 'discover'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => {
              setParams(v === 'todo' ? {} : { view: v }, { replace: true })
              track('next_steps_view', { view: v })
            }}
            className={`rounded py-2.5 text-[17px] font-semibold ${view === v ? 'bg-ink text-paper' : ''}`}
          >
            {t(`steps.${v}`)}{' '}
            {v === 'todo' && <span className={view === v ? 'text-sign' : 'text-muted'}>{openTasks}</span>}
          </button>
        ))}
      </div>

      {view === 'todo' && (<>
      <div className="mt-5">
        <p className="text-sm text-muted">{t('timeline.progress', { done: String(doneCount), total: String(plan.length) })}</p>
        <div className="mt-1.5 h-2 bg-concrete">
          <div className="h-2 bg-ink" style={{ width: `${plan.length ? (doneCount / plan.length) * 100 : 0}%` }} />
        </div>
      </div>

      {weeks.map((week) => {
        const tasks = plan.filter((p) => p.week === week)
        if (!tasks.length) return null
        const isPast = week < currentWeek
        const open = tasks.filter((p) => !p.done)
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
      </>)}

      {view === 'discover' && (
        <div>
          <p className="mt-4 text-muted">
            {t('discover.intro')} <span className="font-semibold text-ink">{t('discover.tried', { n: String(tried.size) })}</span>
          </p>

          <Link
            to="/discover/personalise"
            onClick={() => track('taste_opened', {})}
            className={`mt-4 flex items-center justify-between gap-3 rounded-md border-2 border-ink p-3 ${personalised ? '' : 'bg-sign'}`}
          >
            <span>
              <span className="block font-semibold">{personalised ? t('discover.personalised') : t('discover.personalise')}</span>
              {!personalised && <span className="block text-sm">{t('discover.personaliseHint')}</span>}
            </span>
            <span aria-hidden className="text-xl">›</span>
          </Link>

          {hols.length > 0 && (
            <div className="mt-5 rounded-md border-2 border-ink p-3">
              <p className="text-sm font-semibold">{t('discover.comingUp')}</p>
              <ul className="mt-1.5 divide-y divide-ink/10">
                {hols.map((h) => (
                  <HolidayRow key={h.holiday.id + h.date.getFullYear()} h={h} />
                ))}
              </ul>
            </div>
          )}

          {dayTrips.length > 0 && cityName && (
            <div className="mt-5">
              <p className="font-semibold">{t('discover.trips', { city: cityName })}</p>
              <p className="text-sm text-muted">{t('discover.tripsNote')}</p>
              <ul className="mt-2 space-y-2">
                {dayTrips.map((x) => (
                  <TripCard key={x.id} trip={x} />
                ))}
              </ul>
            </div>
          )}

          <div role="tablist" aria-label={t('discover.categories')} className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={cat === c}
                onClick={() => {
                  setParams({ view: 'discover', ...(c === 'food' ? {} : { cat: c }) }, { replace: true })
                  track('discover_category', { category: c })
                }}
                className={`shrink-0 rounded-md border-2 px-3 py-1.5 text-[15px] font-semibold ${
                  cat === c ? 'border-ink bg-ink text-paper' : 'border-ink/20'
                }`}
              >
                {t(`cat.${c}`)} <span className={cat === c ? 'text-sign' : 'text-muted'}>{fun[c].length}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">{t(`cat.${cat}.intro`)}</p>
          <ul className="mt-3 space-y-2">
            {fun[cat].map((sug) => (
              <ActivityCard
                key={sug.activity.id}
                s={sug}
                spots={spotsFor(sug.activity.id, profile.cityId)}
                cityName={cityName}
                hideAlt={saved.taste?.alcohol === 'yes'}
                tried={tried.has(sug.activity.id)}
                onTried={() => toggleTried(sug.activity.id)}
                onRemove={() => remove(sug.activity.id)}
              />
            ))}
          </ul>
          {fun[cat].length === 0 && <p className="mt-3 text-muted">{t('discover.empty')}</p>}
          {(saved.removed?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => persist((s) => ({ ...s, removed: [] }))}
              className="mt-6 text-sm font-semibold underline"
            >
              {t('discover.restore', { n: String(saved.removed!.length) })}
            </button>
          )}
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


function ActivityCard({
  s,
  spots,
  cityName,
  hideAlt,
  tried,
  onTried,
  onRemove,
}: {
  s: Suggestion
  spots: Spot[]
  cityName?: string
  hideAlt: boolean
  tried: boolean
  onTried: () => void
  onRemove: () => void
}) {
  const a = s.activity
  const why = s.reasons.map((r) => t(r.key as Key, r.vars))
  const label = [a.kind === 'drink' && t('fun.drink'), ...why].filter(Boolean).join(' · ')
  return (
    <li className={`relative rounded-md border-2 p-3.5 pr-11 ${tried ? 'border-ink bg-sign' : 'border-ink/20'}`}>
      {label && <p className="text-xs font-semibold text-muted">{label}</p>}
      <p className="mt-0.5 font-semibold">{a.title.en}</p>
      <p className="mt-1 text-sm">{a.body.en}</p>
      {a.alt && !hideAlt && <p className="mt-1 text-sm text-muted">{a.alt.en}</p>}
      {spots.length > 0 && cityName && (
        <details className="mt-2 rounded-md bg-concrete/60 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">{t('discover.whereToTry', { city: cityName })}</summary>
          <ul className="mt-1.5 space-y-2">
            {spots.map((sp) => {
              const href = safeUrl(sp.url)
              return (
                <li key={sp.name} className="text-sm">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                      {sp.name}
                    </a>
                  ) : (
                    <span className="font-semibold">{sp.name}</span>
                  )}
                  <span className="text-muted"> — {sp.area}</span>
                  <span className="block">{sp.note.en}</span>
                </li>
              )
            })}
          </ul>
        </details>
      )}
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

function TripCard({ trip }: { trip: Trip }) {
  const href = safeUrl(trip.url)
  return (
    <li className="rounded-md border-2 border-ink/20 p-3.5">
      <p className="text-xs font-semibold text-muted">{trip.travel.en}</p>
      <p className="mt-0.5 font-semibold">{trip.title.en}</p>
      <p className="mt-1 text-sm">{trip.body.en}</p>
      <p className="mt-1.5 text-sm">
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            {t('trip.more')}
          </a>
        )}
        {trip.status === 'draft' && <span className="ml-2 bg-sign-soft px-1">{t('draft.badge')}</span>}
      </p>
    </li>
  )
}

function HolidayRow({ h }: { h: DatedHoliday }) {
  const pub = h.holiday.kind === 'public'
  return (
    <li>
      <details className="py-1.5">
        <summary className="flex cursor-pointer list-none items-baseline gap-3 [&::-webkit-details-marker]:hidden">
          <span className="w-24 shrink-0 text-sm text-muted">{fmtHoliday.format(h.date)}</span>
          <span className="font-semibold">{h.holiday.title.en}</span>
          {pub && <span className="ml-auto shrink-0 bg-ink px-1.5 text-xs font-semibold text-sign">{t('fun.closed')}</span>}
        </summary>
        <p className="mt-1 pl-27 text-sm">{h.holiday.body.en}</p>
      </details>
    </li>
  )
}
