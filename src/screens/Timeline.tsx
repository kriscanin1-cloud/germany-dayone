import { useMemo } from 'react'
import { scenario, SHOW_DRAFTS } from '../lib/content'
import { parseDate, planTasks, type Bucket } from '../lib/engine'
import { t } from '../lib/i18n'
import { load } from '../lib/storage'
import type { Profile } from '../lib/types'

// Until onboarding exists, the timeline previews a sample profile.
const SAMPLE: Profile = { purpose: 'study', eu: false, arrival: isoDaysAgo(4), state: 'DE-BE', cityId: 'berlin' }

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ORDER: Bucket[] = ['overdue', 'thisWeek', 'next', 'later', 'done']
const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

export function Timeline() {
  const saved = load()
  const profile = saved.profile ?? SAMPLE
  const plan = useMemo(
    () => planTasks(scenario.tasks, profile, saved.done, { showDrafts: SHOW_DRAFTS }),
    [profile, saved.done],
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
      {!saved.profile && <p className="mt-3 text-muted">{t('timeline.sample')}</p>}

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
              {items.map(({ task, due, blockedBy }) => (
                <li key={task.id} className="flex gap-4 border-b border-ink/15 py-3.5">
                  <div className="w-14 shrink-0 pt-0.5">
                    <p className="font-sign text-[22px] leading-none font-bold">
                      {/* arrival day is Day 1, so an offset of N days is Day N+1 */}
                      Day {task.deadline.offsetDays + 1}
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
    </section>
  )
}
