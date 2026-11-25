import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { scenario, SHOW_DRAFTS } from '../lib/content'
import { parseDate, planMilestones, planTasks, type Bucket } from '../lib/engine'
import { t } from '../lib/i18n'
import { toProfile } from '../lib/questionnaire'
import { load } from '../lib/storage'
import type { Profile } from '../lib/types'

// Until onboarding exists, the timeline previews a sample profile.
const SAMPLE: Profile = { purpose: 'study', eu: false, citizenship: 'other', status: 'national_visa', arrival: isoDaysAgo(4), state: 'DE-BE', cityId: 'berlin' }

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ORDER: Bucket[] = ['overdue', 'thisWeek', 'next', 'later', 'done']
const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

export function Timeline() {
  const saved = load()
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
  const doneCount = plan.filter((p) => p.done).length
  const arrival = parseDate(profile.arrival)
  const today = Math.max(1, Math.floor((Date.now() - arrival.getTime()) / 86_400_000) + 1)

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-sign text-[32px] leading-none font-bold">{t('timeline.title')}</h1>
        <p className="shrink-0 rounded-md bg-sign px-2.5 py-1 font-sign text-lg leading-none font-bold">
          Day {today}
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
        <p className="text-sm text-muted">
          {doneCount} of {plan.length} done
        </p>
        <div className="mt-1.5 h-2 bg-concrete">
          <div className="h-2 bg-ink" style={{ width: `${plan.length ? (doneCount / plan.length) * 100 : 0}%` }} />
        </div>
      </div>

      {plan.length === 0 && (
        <p className="mt-8 border-l-4 border-sign pl-3 text-muted">
          No verified tasks yet — content is being checked against official sources.
        </p>
      )}

      {ORDER.map((bucket) => {
        const items = plan.filter((p) => p.bucket === bucket)
        if (!items.length) return null
        return (
          <div key={bucket} className="mt-8">
            <h2 className={`font-sign text-xl font-bold ${bucket === 'overdue' ? 'text-alert' : ''}`}>
              {t(`bucket.${bucket}`)}
            </h2>
            <ol className="mt-2 border-t-2 border-ink">
              {items.map(({ task, due, day, blockedBy }) => (
                <li key={task.id} className="flex gap-4 border-b border-ink/15 py-3.5">
                  <div className="w-[4.5rem] shrink-0 pt-0.5">
                    <p className="font-sign text-[22px] leading-none font-bold whitespace-nowrap">
                      {/* arrival day is Day 1 */}
                      {day >= 1 ? `Day ${day}` : 'Now'}
                    </p>
                    <p className="mt-1 text-xs text-muted">{fmt.format(due)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[17px] leading-snug font-semibold">{task.title.en}</p>
                    <p className="mt-1 text-sm text-muted">
                      {task.deadline.hard && <span className="font-semibold text-alert">Legal deadline. </span>}
                      {blockedBy.length > 0 && <span>Do first: {blockedBy.join(', ')}. </span>}
                      {task.status === 'draft' && <span className="bg-sign-soft px-1">{t('draft.badge')}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )
      })}

      {milestones.length > 0 && (
        <div className="mt-10">
          <h2 className="font-sign text-xl font-bold">{t('timeline.ahead')}</h2>
          <ol className="mt-2 border-t-2 border-ink">
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
    </section>
  )
}
