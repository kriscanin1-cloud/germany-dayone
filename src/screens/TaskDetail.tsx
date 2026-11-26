import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { track } from '../lib/analytics'
import { scenario } from '../lib/content'
import { dueDate, daysBetween, parseDate } from '../lib/engine'
import { t } from '../lib/i18n'
import { safeUrl } from '../lib/url'
import { toProfile } from '../lib/questionnaire'
import { useDone } from '../lib/useDone'
import type { ChoiceItem } from '../lib/types'
import { DoneDialog } from './Timeline'

export function TaskDetail() {
  const { id } = useParams()
  const task = scenario.tasks.find((x) => x.id === id)
  const { saved, isDone, ask, asking, confirm, close } = useDone()

  useEffect(() => {
    if (task) track('task_opened', { task: task.id })
  }, [task])

  if (!task) {
    return (
      <section>
        <p className="text-muted">{t('task.notFound')}</p>
        <Link to="/timeline" className="mt-4 inline-block font-semibold underline">‹ {t('task.back')}</Link>
      </section>
    )
  }

  const profile = saved.profile && !saved.profile.citizenship && saved.answers ? toProfile(saved.answers) : saved.profile
  const week = profile
    ? Math.max(1, Math.ceil((daysBetween(parseDate(profile.arrival), dueDate(task, profile)) + 1) / 7))
    : null
  const done = isDone(task.id)
  const titles = new Map(scenario.tasks.map((x) => [x.id, x.title.en]))
  const deps = task.dependsOn.filter((d) => !saved.done.includes(d))

  return (
    <article className="pb-6">
      <Link to="/timeline" className="-ml-1 font-semibold">‹ {t('task.back')}</Link>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
        {week && <span className="bg-sign px-2 py-0.5">{t('task.when', { n: String(week) })}</span>}
        {task.deadline.hard && <span className="text-alert">{t('task.legal')}</span>}
      </div>
      <h1 className={`mt-2 font-sign text-[30px] leading-tight font-bold ${done ? 'text-muted line-through' : ''}`}>
        {task.title.en}
      </h1>
      <p className="mt-3 text-[17px]">{task.summary.en}</p>
      {task.deadline.note && <p className="mt-3 border-l-4 border-alert pl-3 text-sm">{task.deadline.note.en}</p>}
      {deps.length > 0 && (
        <p className="mt-3 text-sm text-muted">{t('task.first', { list: deps.map((d) => titles.get(d) ?? d).join('; ') })}</p>
      )}

      <Section title={t('task.why')}>
        <p>{task.why.en}</p>
      </Section>

      {task.choices && (
        <Section title={task.choices.title.en}>
          {task.choices.intro && <p className="mb-3">{task.choices.intro.en}</p>}
          <ul className="space-y-3">
            {task.choices.items.map((c) => (
              <Choice key={c.name} c={c} />
            ))}
          </ul>
          {task.choices.note && <p className="mt-3 text-sm text-muted">{task.choices.note.en}</p>}
        </Section>
      )}

      {task.steps.length > 0 && (
        <Section title={t('task.steps')}>
          <ol className="space-y-3">
            {task.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink font-sign font-bold text-sign">
                  {i + 1}
                </span>
                <span className="pt-0.5">{s.en}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {task.documents.length > 0 && (
        <Section title={t('task.documents')}>
          <ul className="list-disc space-y-1 pl-5">
            {task.documents.map((d, i) => (
              <li key={i}>{d.en}</li>
            ))}
          </ul>
        </Section>
      )}

      {task.tips && task.tips.length > 0 && (
        <Section title={t('task.tips')}>
          <ul className="space-y-2">
            {task.tips.map((x, i) => (
              <li key={i} className="border-l-4 border-sign pl-3">{x.en}</li>
            ))}
          </ul>
        </Section>
      )}

      {task.links.length > 0 && (
        <Section title={t('task.links')}>
          <ul className="space-y-1">
            {task.links.map((l) => (
              <li key={l.url}>
                <a href={safeUrl(l.url)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  {l.label.en} ↗
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="mt-6 text-sm text-muted">
        {task.status === 'verified' ? t('task.checked', { date: task.lastVerified }) : t('task.draftNote')}{' '}
        {t('me.disclaimer')}
      </p>

      <button
        type="button"
        onClick={() => ask(task.id, task.title.en)}
        className={`mt-6 w-full rounded-md py-4 text-lg font-semibold ${done ? 'border-2 border-ink' : 'bg-ink text-paper'}`}
      >
        {done ? t('task.isDone') : t('task.markDoneCta')}
      </button>

      <DoneDialog asking={asking} confirm={confirm} close={close} />
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="border-b-2 border-ink pb-1 font-sign text-xl font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Choice({ c }: { c: ChoiceItem }) {
  return (
    <li className="rounded-md border-2 border-ink/20 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-sign text-xl font-bold">{c.name}</p>
        <a
          href={safeUrl(c.url)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('choice_clicked', { name: c.name })}
          className="shrink-0 text-sm font-semibold underline"
        >
          Website ↗
        </a>
      </div>
      <p className="text-sm text-muted">{c.tag.en}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold">{t('task.pros')}</p>
          <ul className="mt-1 space-y-1 text-[15px]">
            {c.pros.map((x, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden className="font-bold">+</span>{x.en}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">{t('task.cons')}</p>
          <ul className="mt-1 space-y-1 text-[15px]">
            {c.cons.map((x, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden className="font-bold text-alert">–</span>{x.en}</li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  )
}
