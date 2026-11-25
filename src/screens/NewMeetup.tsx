import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { activities } from '../lib/activities'
import { track } from '../lib/analytics'
import { t } from '../lib/i18n'
import { AUDIENCES, LANGUAGES, MEETUP_TYPES, type Audience, type Meetup, type MeetupType } from '../lib/people'
import { load, update } from '../lib/storage'
import { placeName } from './People'

const pad = (n: number) => String(n).padStart(2, '0')
function nextSaturday(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function NewMeetup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const activity = activities.find((a) => a.id === params.get('activity'))
  const saved = load()

  const [type, setType] = useState<MeetupType>(activity ? (activity.kind === 'culture' ? 'walk' : 'food') : 'coffee')
  const [title, setTitle] = useState(activity ? `${activity.title.en} — together` : '')
  const [date, setDate] = useState(nextSaturday())
  const [time, setTime] = useState('15:00')
  const [area, setArea] = useState('')
  const [languages, setLanguages] = useState<string[]>(saved.me?.languages?.length ? saved.me.languages : ['English'])
  const [audience, setAudience] = useState<Audience[]>(['everyone'])
  const [maxPeople, setMaxPeople] = useState(6)
  const [womenOnly, setWomenOnly] = useState(false)
  const [rules, setRules] = useState(false)

  const toggle = <V,>(list: V[], v: V, set: (x: V[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const ok = title.trim().length >= 4 && area.trim().length >= 2 && date && time && languages.length > 0 && rules

  const submit = () => {
    const m: Meetup = {
      id: `mine-${Date.now()}`,
      type,
      title: title.trim(),
      startsAt: `${date}T${time}`,
      area: area.trim(),
      languages,
      audience: audience.length ? audience : ['everyone'],
      maxPeople,
      womenOnly,
      host: { name: saved.me?.name || 'You' },
      interested: 0,
      going: 1,
      mine: true,
    }
    update((s) => ({ ...s, meetups: [...(s.meetups ?? []), m] }))
    // coarse only: never the title, place or time
    track('meetup_created', {
      type,
      audience: m.audience.join(','),
      max_people: maxPeople,
      women_only: womenOnly,
      from_activity: activity?.id ?? null,
      city_listed: Boolean(saved.profile?.cityId),
    })
    navigate('/people', { replace: true })
  }

  const chip = (on: boolean) =>
    `rounded-md border-2 px-3 py-1.5 text-[15px] font-semibold ${on ? 'border-ink bg-ink text-paper' : 'border-ink/20'}`
  const label = 'mt-6 block font-semibold'
  const input = 'mt-2 w-full rounded-md border-2 border-ink bg-paper px-4 py-3 text-[17px]'

  return (
    <section className="pb-6">
      <Link to="/people" className="-ml-1 font-semibold">‹ {t('people.title')}</Link>
      <h1 className="mt-4 font-sign text-[30px] leading-tight font-bold">{t('meetup.title')}</h1>
      <p className="mt-2 text-muted">{t('meetup.intro', { place: saved.profile ? placeName(saved.profile) : 'your city' })}</p>

      <p className={label}>{t('meetup.what')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {MEETUP_TYPES.map((x) => (
          <button key={x} type="button" aria-pressed={type === x} onClick={() => setType(x)} className={chip(type === x)}>
            {t(`people.type.${x}`)}
          </button>
        ))}
      </div>

      <label className={label}>
        {t('meetup.name')}
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t('meetup.namePh')} className={input} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          {t('meetup.date')}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </label>
        <label className={label}>
          {t('meetup.time')}
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
        </label>
      </div>

      <label className={label}>
        {t('meetup.where')}
        <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={60} placeholder={t('meetup.wherePh')} className={input} />
        <span className="mt-1 block text-sm font-normal text-muted">{t('meetup.whereNote')}</span>
      </label>

      <p className={label}>{t('meetup.languages')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {LANGUAGES.map((l) => (
          <button key={l} type="button" aria-pressed={languages.includes(l)} onClick={() => toggle(languages, l, setLanguages)} className={chip(languages.includes(l))}>
            {l}
          </button>
        ))}
      </div>

      <p className={label}>{t('meetup.forWhom')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <button key={a} type="button" aria-pressed={audience.includes(a)} onClick={() => toggle(audience, a, setAudience)} className={chip(audience.includes(a))}>
            {t(`people.f.${a}`)}
          </button>
        ))}
      </div>

      <label className={label}>
        {t('meetup.size')}
        <select value={maxPeople} onChange={(e) => setMaxPeople(Number(e.target.value))} className={input}>
          {[3, 4, 5, 6, 8, 10, 15].map((n) => (
            <option key={n} value={n}>{t('people.upTo', { n: String(n) })}</option>
          ))}
        </select>
      </label>

      <label className="mt-6 flex cursor-pointer gap-3">
        <input type="checkbox" checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-black" />
        <span>{t('meetup.womenOnly')}</span>
      </label>
      <label className="mt-4 flex cursor-pointer gap-3 rounded-md border-2 border-ink p-4">
        <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-black" />
        <span>{t('meetup.rules')}</span>
      </label>

      <button
        type="button"
        disabled={!ok}
        onClick={submit}
        className="mt-6 w-full rounded-md bg-ink py-4 text-lg font-semibold text-paper disabled:bg-concrete disabled:text-muted"
      >
        {t('meetup.submit')}
      </button>
      <p className="mt-3 text-sm text-muted">{t('meetup.fakeNote')}</p>
    </section>
  )
}
