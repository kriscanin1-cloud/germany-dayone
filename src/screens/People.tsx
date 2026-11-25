import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { track } from '../lib/analytics'
import { cities, states } from '../lib/content'
import { t } from '../lib/i18n'
import {
  AUDIENCES,
  commonGround,
  exampleMeetups,
  filterMeetups,
  isUpcoming,
  LANGUAGES,
  type Filter,
  type Meetup,
  type Rsvp,
} from '../lib/people'
import { toProfile } from '../lib/questionnaire'
import { load, update, type Saved } from '../lib/storage'
import type { Profile } from '../lib/types'

const SAMPLE: Profile = { purpose: 'study', eu: false, arrival: new Date().toISOString().slice(0, 10), state: 'DE-SN', cityId: 'leipzig' }
const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function placeName(p: Profile): string {
  return cities.find((c) => c.id === p.cityId)?.name ?? states.find((s) => s.code === p.state)?.name ?? 'your area'
}

export function People() {
  const [saved, setSaved] = useState<Saved>(() => load())
  const profile =
    saved.profile && !saved.profile.citizenship && saved.answers ? toProfile(saved.answers) : (saved.profile ?? SAMPLE)
  const [filters, setFilters] = useState<Set<Filter>>(new Set())
  const [language, setLanguage] = useState<string>('')
  const place = placeName(profile)

  const mine = (saved.meetups ?? []).filter((m) => isUpcoming(m))
  const examples = useMemo(() => exampleMeetups(), [])
  const shownExamples = filterMeetups(examples, profile, filters, language || undefined)
  const rsvps = saved.rsvps ?? {}

  const persist = (change: (s: Saved) => Saved) => setSaved(update(change))
  const toggleFilter = (f: Filter) =>
    setFilters((cur) => {
      const next = new Set(cur)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      track('people_filter', { filter: f, on: next.has(f) })
      return next
    })
  const rsvp = (m: Meetup, kind: Rsvp) => {
    const current = rsvps[m.id]
    const next = current === kind ? undefined : kind
    track('meetup_rsvp', { kind: next ?? 'none', type: m.type, example: Boolean(m.example) })
    persist((s) => {
      const r = { ...(s.rsvps ?? {}) }
      if (next) r[m.id] = next
      else delete r[m.id]
      return { ...s, rsvps: r }
    })
  }
  const toggleNotify = () => {
    track('meetup_notify', { on: !saved.notifyMeetups, city_listed: Boolean(profile.cityId) })
    persist((s) => ({ ...s, notifyMeetups: !s.notifyMeetups }))
  }

  return (
    <section>
      <h1 className="font-sign text-[32px] leading-none font-bold">{t('people.title')}</h1>
      <p className="mt-2 text-muted">{t('people.intro', { place })}</p>

      <Link
        to="/people/new"
        onClick={() => track('meetup_create_opened', { from: 'people' })}
        className="mt-5 block rounded-md bg-ink py-4 text-center text-lg font-semibold text-paper"
      >
        {t('people.create')}
      </Link>

      {mine.length > 0 && (
        <div className="mt-8">
          <h2 className="border-b-2 border-ink pb-1 font-sign text-xl font-bold">{t('people.mine')}</h2>
          <p className="mt-2 text-sm text-muted">{t('people.mineNote')}</p>
          <ul className="mt-3 space-y-3">
            {mine.map((m) => (
              <MeetupCard key={m.id} m={m} profile={profile} />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 rounded-md border-2 border-ink bg-sign-soft p-4">
        <p className="font-sign text-xl font-bold">{t('people.empty', { place })}</p>
        <p className="mt-1">{t('people.emptyBody')}</p>
        <label className="mt-3 flex cursor-pointer items-center gap-3 font-semibold">
          <input type="checkbox" checked={Boolean(saved.notifyMeetups)} onChange={toggleNotify} className="h-5 w-5 accent-black" />
          {t('people.notify', { place })}
        </label>
      </div>

      <div className="mt-8">
        <h2 className="border-b-2 border-ink pb-1 font-sign text-xl font-bold">{t('people.examples')}</h2>
        <p className="mt-2 text-sm text-muted">{t('people.examplesNote')}</p>

        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1" aria-label={t('people.filters')}>
          {(['likeMe', ...AUDIENCES.filter((a) => a !== 'everyone')] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filters.has(f)}
              onClick={() => toggleFilter(f)}
              className={`shrink-0 rounded-md border-2 px-3 py-1.5 text-[15px] font-semibold ${
                filters.has(f) ? 'border-ink bg-ink text-paper' : 'border-ink/20'
              }`}
            >
              {t(`people.f.${f}`)}
            </button>
          ))}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label={t('people.language')}
            className="shrink-0 rounded-md border-2 border-ink/20 bg-paper px-2 py-1.5 text-[15px] font-semibold"
          >
            <option value="">{t('people.anyLanguage')}</option>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>

        <ul className="mt-3 space-y-3">
          {shownExamples.map((m) => (
            <MeetupCard key={m.id} m={m} profile={profile} rsvp={rsvps[m.id]} onRsvp={(k) => rsvp(m, k)} />
          ))}
        </ul>
        {shownExamples.length === 0 && <p className="mt-3 text-muted">{t('people.noMatch')}</p>}
      </div>

      <p className="mt-8 text-sm text-muted">{t('people.safety')}</p>
    </section>
  )
}

function MeetupCard({
  m,
  profile,
  rsvp,
  onRsvp,
}: {
  m: Meetup
  profile: Profile
  rsvp?: Rsvp
  onRsvp?: (k: Rsvp) => void
}) {
  const common = m.mine ? [] : commonGround(profile, m)
  const extra = (k: Rsvp) => (rsvp === k ? 1 : 0)
  return (
    <li className="rounded-md border-2 border-ink/20 p-4">
      <p className="text-xs font-semibold text-muted">
        {t(`people.type.${m.type}`)}
        {m.example && <span className="ml-2 bg-concrete px-1 text-ink">{t('people.example')}</span>}
        {m.womenOnly && <span className="ml-2 bg-sign-soft px-1 text-ink">{t('people.womenOnly')}</span>}
      </p>
      <p className="mt-0.5 text-[17px] leading-snug font-semibold">{m.title}</p>
      <p className="mt-1 text-[15px]">
        {fmt.format(new Date(m.startsAt))} · {m.area}
      </p>
      <p className="mt-0.5 text-sm text-muted">
        {m.mine ? t('people.byYou') : t('people.by', { name: m.host.name })} · {m.languages.join(', ')} ·{' '}
        {t('people.upTo', { n: String(m.maxPeople) })}
      </p>
      {common.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {common.map((c) => (
            <li key={c} className="bg-sign px-1.5 text-sm font-semibold">{c}</li>
          ))}
        </ul>
      )}
      {onRsvp && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            aria-pressed={rsvp === 'interested'}
            onClick={() => onRsvp('interested')}
            className={`flex-1 rounded-md border-2 border-ink py-2 font-semibold ${rsvp === 'interested' ? 'bg-sign' : ''}`}
          >
            {t('people.interested')} · {m.interested + extra('interested')}
          </button>
          <button
            type="button"
            aria-pressed={rsvp === 'going'}
            onClick={() => onRsvp('going')}
            className={`flex-1 rounded-md border-2 border-ink py-2 font-semibold ${rsvp === 'going' ? 'bg-ink text-paper' : ''}`}
          >
            {rsvp === 'going' ? t('people.goingOn') : t('people.going')} · {m.going + extra('going')}
          </button>
        </div>
      )}
    </li>
  )
}
