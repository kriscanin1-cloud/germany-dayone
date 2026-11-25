import { useMemo } from 'react'
import { scenario, SHOW_DRAFTS } from '../lib/content'
import { planTasks, type Bucket } from '../lib/engine'
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

  return (
    <section>
      <h1 className="text-2xl font-bold">{t('timeline.title')}</h1>
      {!saved.profile && <p className="mt-2 text-sm text-gray-500">{t('timeline.sample')}</p>}

      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500">
          <span>
            {doneCount} of {plan.length} done
          </span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-brand"
            style={{ width: `${plan.length ? (doneCount / plan.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {plan.length === 0 && (
        <p className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          No verified tasks yet — content is being checked against official sources.
        </p>
      )}

      {ORDER.map((bucket) => {
        const items = plan.filter((p) => p.bucket === bucket)
        if (!items.length) return null
        return (
          <div key={bucket} className="mt-6">
            <h2 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{t(`bucket.${bucket}`)}</h2>
            <ul className="mt-2 space-y-2">
              {items.map(({ task, due, blockedBy }) => (
                <li key={task.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{task.title.en}</span>
                    <span className="shrink-0 text-xs text-gray-500">{fmt.format(due)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{task.category}</span>
                    {task.deadline.hard && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">deadline</span>
                    )}
                    {blockedBy.length > 0 && (
                      <span className="rounded-full bg-gray-50 px-2 py-0.5 text-gray-500">after: {blockedBy.join(', ')}</span>
                    )}
                    {task.status === 'draft' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{t('draft.badge')}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
