import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { analyticsEnabled, isStandalone, track } from '../lib/analytics'
import { cities, scenario, states } from '../lib/content'
import { countdown, humanDays, type Urgency } from '../lib/dates'
import { daysBetween, parseDate } from '../lib/engine'
import { t } from '../lib/i18n'
import { LANGUAGES } from '../lib/people'
import { INTEREST_LABELS } from '../lib/personal'
import { CONSENT_ID, questionnaire, toProfile } from '../lib/questionnaire'
import { load, update, wipe, type MeInfo, type Saved } from '../lib/storage'

const INTERESTS = INTEREST_LABELS

const label = (questionId: string, optionId?: string) =>
  questionnaire.questions.find((q) => q.id === questionId)?.options?.find((o) => o.id === optionId)?.label

export function Me() {
  const navigate = useNavigate()
  const [saved, setSaved] = useState<Saved>(() => load())
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const installed = isStandalone()
  const me = saved.me ?? {}
  const profile = saved.profile && !saved.profile.citizenship && saved.answers ? toProfile(saved.answers) : saved.profile

  const setMe = (patch: Partial<MeInfo>) => setSaved(update((s) => ({ ...s, me: { ...s.me, ...patch } })))
  const toggleIn = (key: 'languages' | 'interests', v: string) => {
    const cur = me[key] ?? []
    setMe({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] })
  }

  if (deletedId) {
    return (
      <section>
        <h1 className="font-sign text-[32px] leading-none font-bold">{t('me.title')}</h1>
        <p className="mt-6">{t('me.deleted')}</p>
        <p className="mt-2 text-sm text-muted">
          {t('me.id')} <span className="break-all">{deletedId}</span>
        </p>
        <button type="button" onClick={() => navigate('/')} className="mt-4 rounded-md bg-ink px-4 py-3 font-semibold text-paper">
          {t('welcome.cta')}
        </button>
      </section>
    )
  }

  const week = profile ? Math.max(1, Math.ceil((daysBetween(parseDate(profile.arrival), new Date()) + 1) / 7)) : null
  const taskIds = new Set(scenario.tasks.map((x) => x.id))
  const doneCount = saved.done.filter((id) => taskIds.has(id)).length
  const place = profile && (cities.find((c) => c.id === profile.cityId)?.name ?? states.find((s) => s.code === profile.state)?.name)

  return (
    <section className="pb-6">
      <h1 className="font-sign text-[32px] leading-none font-bold">{me.name ? t('me.hi', { name: me.name }) : t('me.title')}</h1>

      {/* your journey */}
      {profile && (
        <div className="ortsschild mt-5">
          <div className="grid grid-cols-3 divide-x-2 divide-ink px-1 py-3 text-center">
            <Stat n={String(week)} label={t('me.statWeek')} />
            <Stat n={String(doneCount)} label={t('me.statDone')} />
            <Stat n={String(saved.tried?.length ?? 0)} label={t('me.statTried')} />
          </div>
        </div>
      )}

      {/* about you */}
      <Block title={t('me.about')} note={t('me.aboutNote')}>
        <label className="block font-semibold">
          {t('me.name')}
          <input
            value={me.name ?? ''}
            onChange={(e) => setMe({ name: e.target.value.slice(0, 30) })}
            onBlur={() => me.name && track('me_name_set')}
            placeholder={t('me.namePh')}
            autoComplete="given-name"
            className="mt-2 w-full rounded-md border-2 border-ink bg-paper px-4 py-3 text-[17px] font-normal"
          />
        </label>
        <p className="mt-5 font-semibold">{t('me.languages')}</p>
        <Chips options={LANGUAGES} selected={me.languages ?? []} onToggle={(v) => toggleIn('languages', v)} />
        <p className="mt-5 font-semibold">{t('me.interests')}</p>
        <Chips options={INTERESTS} selected={me.interests ?? []} onToggle={(v) => toggleIn('interests', v)} />
        <label className="mt-5 block font-semibold">
          {t('me.aboutLine')}
          <input
            value={me.about ?? ''}
            onChange={(e) => setMe({ about: e.target.value.slice(0, 120) })}
            placeholder={t('me.aboutPh')}
            className="mt-2 w-full rounded-md border-2 border-ink bg-paper px-4 py-3 text-[17px] font-normal"
          />
        </label>
      </Block>

      {/* your situation */}
      {profile && (
        <Block title={t('me.situation')} note={t('me.situationNote')}>
          <dl className="divide-y divide-ink/15 border-y border-ink/15">
            <Row k={t('me.s.purpose')} v={label('purpose', profile.purpose)} />
            <Row k={t('me.s.passport')} v={profile.citizenship ? t(`me.cit.${profile.citizenship}`) : undefined} />
            {profile.status && <Row k={t('me.s.status')} v={label('status', profile.status)} />}
            <Row k={t('me.s.place')} v={place} />
            <Row k={t('me.s.arrival')} v={fmtDate(profile.arrival)} />
            <Row k={t('me.s.household')} v={label('household', profile.household)} />
            <Row k={t('me.s.german')} v={label('german_level', profile.germanLevel)} />
          </dl>
          <Link to="/onboarding" className="mt-4 block rounded-md border-2 border-ink py-3 text-center font-semibold">
            {t('me.edit')}
          </Link>
        </Block>
      )}

      {/* important dates */}
      {profile && (
        <Block title={t('me.dates')} note={t('me.datesNote')}>
          {!profile.eu && (
            <DateRow
              title={t('me.visaEnd')}
              value={profile.visaEnd}
              advice={t('me.visaAdvice')}
              onChange={(v) =>
                setSaved(update((s) => ({
                  ...s,
                  profile: s.profile ? { ...s.profile, visaEnd: v || undefined } : s.profile,
                  answers: { ...s.answers, visa_end: v || undefined },
                })))
              }
            />
          )}
          <DateRow
            title={t('me.passportEnd')}
            value={me.passportEnd}
            advice={t('me.passportAdvice')}
            onChange={(v) => setMe({ passportEnd: v || undefined })}
          />
        </Block>
      )}

      {/* settings */}
      <Block title={t('me.settings')}>
        <Toggle
          on={Boolean(saved.notifyMeetups)}
          label={t('me.notifyMeetups')}
          onChange={(on) => setSaved(update((s) => ({ ...s, notifyMeetups: on })))}
        />
        {CONSENT_ID && (
          <Toggle
            on={saved.consent === CONSENT_ID}
            label={questionnaire.consents[CONSENT_ID].text}
            onChange={(on) => {
              track('consent_changed', { on })
              setSaved(update((s) => ({ ...s, consent: on ? CONSENT_ID! : undefined })))
            }}
          />
        )}
        <p className="mt-4 text-sm">
          <span className="font-semibold">{t('me.language')}</span> English · {t('me.moreLanguages')}
        </p>
        {!installed && <p className="mt-4 border-l-4 border-sign pl-3 text-sm">{t('install.ios')}</p>}
      </Block>

      {/* your data */}
      <Block title={t('me.data')}>
        <ul className="list-disc space-y-1 pl-5 text-[15px]">
          <li>{t('me.data1')}</li>
          <li>{t('me.data2')}</li>
          <li>{t('me.data3')}</li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          {t('me.id')} <span className="break-all">{saved.anonId}</span>
        </p>
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} className="mt-4 w-full rounded-md border-2 border-alert py-3 font-semibold text-alert">
            {t('me.delete')}
          </button>
        ) : (
          <div className="mt-4 rounded-md border-2 border-alert p-4">
            <p className="font-semibold">{t('me.deleteAsk')}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 rounded-md border-2 border-ink py-2.5 font-semibold">
                {t('me.deleteNo')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = load().anonId
                  track('data_deleted')
                  wipe()
                  setDeletedId(id)
                }}
                className="flex-1 rounded-md bg-alert py-2.5 font-semibold text-paper"
              >
                {t('me.deleteYes')}
              </button>
            </div>
          </div>
        )}
      </Block>

      <p className="mt-10 text-sm text-muted">{t('me.disclaimer')}</p>
      <p className="mt-1 text-xs text-muted">
        Installed: {installed ? 'yes' : 'no'}. Analytics: {analyticsEnabled ? 'on' : 'off'}.
      </p>
    </section>
  )
}

const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtDate = (iso?: string) => (iso ? fmt.format(parseDate(iso)) : undefined)

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="border-b-2 border-ink pb-1 font-sign text-xl font-bold">{title}</h2>
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <p className="font-sign text-[28px] leading-none font-bold">{n}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  )
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-[15px]">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-semibold">{v ?? '—'}</dd>
    </div>
  )
}

function Chips({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={selected.includes(o)}
          onClick={() => onToggle(o)}
          className={`rounded-md border-2 px-3 py-1.5 text-[15px] font-semibold ${
            selected.includes(o) ? 'border-ink bg-ink text-paper' : 'border-ink/20'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

const urgencyStyle: Record<Urgency, string> = {
  expired: 'bg-alert text-paper',
  urgent: 'bg-alert text-paper',
  soon: 'bg-sign',
  ok: 'bg-concrete',
}

function DateRow({ title, value, advice, onChange }: { title: string; value?: string; advice: string; onChange: (v: string) => void }) {
  const c = value ? countdown(value) : null
  return (
    <div className="mb-5">
      <label className="block font-semibold">
        {title}
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-md border-2 border-ink bg-paper px-4 py-3 text-[17px] font-normal"
        />
      </label>
      {c && (
        <p className="mt-2 text-sm">
          <span className={`px-1.5 py-0.5 font-semibold ${urgencyStyle[c.urgency]}`}>
            {c.urgency === 'expired' ? t('me.expired', { when: humanDays(c.days) }) : t('me.ends', { when: humanDays(c.days) })}
          </span>
          {c.urgency !== 'ok' && <span className="ml-2">{advice}</span>}
        </p>
      )}
    </div>
  )
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <label className="mb-4 flex cursor-pointer gap-3">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-black" />
      <span className="text-[15px]">{label}</span>
    </label>
  )
}
