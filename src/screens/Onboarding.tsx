import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isStandalone, submitResponses, track } from '../lib/analytics'
import { cities, states } from '../lib/content'
import { t } from '../lib/i18n'
import {
  CONSENT_ID,
  canContinue,
  doneFromAnswers,
  migrate,
  normalize,
  otherKey,
  questionnaire,
  toProfile,
  toResearchPayload,
  visibleQuestions,
  type Answers,
  type Place,
  type Question,
} from '../lib/questionnaire'
import { load, update } from '../lib/storage'

const DONE_OPTION_IDS = new Set(
  questionnaire.questions.find((q) => q.id === 'done_already')?.options?.map((o) => o.id) ?? [],
)

function isoToday(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Onboarding() {
  const navigate = useNavigate()
  const saved = load()
  const [answers, setAnswers] = useState<Answers>(() => migrate(saved.answers ?? {}))
  const [step, setStep] = useState(0)
  const [consent, setConsent] = useState(saved.consent === CONSENT_ID)
  // Count follow-up questions in before their trigger is answered, so "1 of 10" doesn't jump to "of 12" later.
  const questions = useMemo(
    () => visibleQuestions({ citizenship: 'other', housing: 'moved_in', ...answers }),
    [answers],
  )
  const total = questions.length + 1 // + final consent step
  const atConsent = step >= questions.length
  const q = atConsent ? null : questions[step]

  useEffect(() => {
    track('onboarding_started', { editing: Boolean(saved.profile) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (q) track('onboarding_step', { question: q.id, step: step + 1 })
  }, [q, step])

  const set = (key: string, value: Answers[string]) => setAnswers((a) => ({ ...a, [key]: value }))

  const next = () => {
    setStep((s) => Math.min(s + 1, total - 1))
    window.scrollTo({ top: 0 })
  }
  const back = () => {
    if (step === 0) navigate('/')
    else setStep((s) => s - 1)
  }

  const finish = () => {
    const profile = toProfile(answers)
    const done = doneFromAnswers(answers)
    update((s) => ({
      ...s,
      profile,
      answers,
      consent: consent && CONSENT_ID ? CONSENT_ID : undefined,
      // replace previous "already done" picks, keep tasks ticked inside the app
      done: [...new Set([...s.done.filter((id) => !DONE_OPTION_IDS.has(id)), ...done])],
    }))
    const days = Math.round((Date.now() - new Date(profile.arrival).getTime()) / 86_400_000)
    track('onboarding_completed', {
      purpose: profile.purpose,
      eu: profile.eu,
      citizenship: profile.citizenship ?? null,
      status: profile.status ?? null,
      state: profile.state,
      city_listed: Boolean(profile.cityId),
      days_since_arrival: days,
      consent: consent,
      is_standalone: isStandalone(),
    })
    if (consent && CONSENT_ID) void submitResponses(toResearchPayload(answers), CONSENT_ID)
    navigate('/timeline', { replace: true })
  }

  const ok = q ? canContinue(q, answers) : true

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-paper">
      <header className="sticky top-0 z-10 bg-paper px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <button type="button" onClick={back} className="-ml-2 rounded-md px-2 py-1.5 font-semibold">
            ‹ {t('onb.back')}
          </button>
          <span className="text-sm text-muted">
            {t('onb.step', { n: String(step + 1), total: String(total) })}
          </span>
        </div>
        {/* progress as lane markings: one segment per step */}
        <div className="mt-3 flex gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 ${i <= step ? 'bg-ink' : 'bg-concrete'}`} />
          ))}
        </div>
      </header>

      <main className="flex-1 px-5 pt-4 pb-32">
        {q ? (
          <QuestionView
            key={q.id}
            q={q}
            answers={answers}
            set={set}
          />
        ) : (
          <section>
            <h1 className="font-sign text-[28px] leading-tight font-bold">{t('onb.consent.title')}</h1>
            <p className="mt-3 text-muted">{t('onb.consent.body')}</p>
            {CONSENT_ID && (
              <label className="mt-6 flex cursor-pointer gap-3 rounded-md border-2 border-ink p-4">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-black"
                />
                <span>{questionnaire.consents[CONSENT_ID].text}</span>
              </label>
            )}
            <p className="mt-4 text-sm text-muted">{t('onb.consent.optional')}</p>
          </section>
        )}
      </main>

      <footer className="safe-bottom fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-ink/15 bg-paper px-5 pt-3 pb-4">
        {atConsent ? (
          <button type="button" onClick={finish} className="w-full rounded-md bg-ink py-4 text-lg font-semibold text-paper">
            {t('onb.finish')}
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            disabled={!ok}
            className="w-full rounded-md bg-ink py-4 text-lg font-semibold text-paper disabled:bg-concrete disabled:text-muted"
          >
            {q && !q.required && !answers[q.id] ? t('onb.skip') : t('onb.next')}
          </button>
        )}
      </footer>
    </div>
  )
}

function QuestionView({
  q,
  answers,
  set,
}: {
  q: Question
  answers: Answers
  set: (key: string, value: Answers[string]) => void
}) {
  return (
    <section>
      <h1 className="font-sign text-[28px] leading-tight font-bold">{q.text}</h1>
      {q.help && <p className="mt-2 text-muted">{q.help}</p>}
      <div className="mt-6">
        {q.type === 'single' && <SingleChoice q={q} answers={answers} set={set} />}
        {q.type === 'multi' && <MultiChoice q={q} answers={answers} set={set} />}
        {q.type === 'date' && <DateInput q={q} answers={answers} set={set} />}
        {q.type === 'city' && <CityPicker value={answers[q.id] as Place | undefined} onChange={(v) => set(q.id, v)} />}
      </div>
      {!q.required && <p className="mt-4 text-sm text-muted">{t('onb.optionalQuestion')}</p>}
    </section>
  )
}

const optionClass = (selected: boolean) =>
  `flex w-full items-center gap-3 rounded-md border-2 px-4 py-3.5 text-left text-[17px] font-medium ${
    selected ? 'border-ink bg-sign' : 'border-ink/20 bg-paper'
  }`

function SingleChoice({
  q,
  answers,
  set,
}: {
  q: Question
  answers: Answers
  set: (key: string, value: Answers[string]) => void
}) {
  const value = answers[q.id]
  const chosen = q.options?.find((o) => o.id === value)
  return (
    <div role="radiogroup" aria-label={q.text} className="space-y-2">
      {q.options?.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={optionClass(value === o.id)}
          onClick={() => set(q.id, o.id)}
        >
          {o.label}
        </button>
      ))}
      {chosen?.freeText && (
        <input
          autoFocus
          type="text"
          maxLength={120}
          placeholder={t('onb.other.placeholder')}
          value={(answers[otherKey(q.id)] as string | undefined) ?? ''}
          onChange={(e) => set(otherKey(q.id), e.target.value)}
          className="mt-1 w-full rounded-md border-2 border-ink px-4 py-3 text-[17px]"
        />
      )}
    </div>
  )
}

function MultiChoice({
  q,
  answers,
  set,
}: {
  q: Question
  answers: Answers
  set: (key: string, value: Answers[string]) => void
}) {
  const value = (answers[q.id] as string[] | undefined) ?? []
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    if (q.max && next.length > q.max) return
    set(q.id, next)
  }
  return (
    <div className="space-y-2">
      {q.options?.map((o) => {
        const on = value.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            className={optionClass(on)}
            onClick={() => toggle(o.id)}
          >
            <span
              aria-hidden
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-sm border-2 border-ink text-sm leading-none ${
                on ? 'bg-ink text-sign' : ''
              }`}
            >
              {on ? '✓' : ''}
            </span>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function DateInput({
  q,
  answers,
  set,
}: {
  q: Question
  answers: Answers
  set: (key: string, value: Answers[string]) => void
}) {
  const value = (answers[q.id] as string | undefined) ?? ''
  const range = q.range ?? { minDays: -730, maxDays: 365 }
  return (
    <div>
      <input
        type="date"
        min={isoToday(range.minDays)}
        max={isoToday(range.maxDays)}
        value={value}
        onChange={(e) => set(q.id, e.target.value)}
        className="w-full rounded-md border-2 border-ink bg-paper px-4 py-3 text-[17px]"
      />
      {range.minDays <= 0 && range.maxDays >= 0 && q.id !== 'visa_end' && (
        <button type="button" onClick={() => set(q.id, isoToday())} className="mt-3 font-semibold underline">
          {t('onb.date.today')}
        </button>
      )}
    </div>
  )
}

const stateName = new Map(states.map((s) => [s.code, s.name]))

function CityPicker({ value, onChange }: { value?: Place; onChange: (v: Place | undefined) => void }) {
  const [query, setQuery] = useState('')
  const [pickState, setPickState] = useState(false)

  const results = useMemo(() => {
    const nq = normalize(query)
    if (nq.length < 2) return []
    return cities
      .filter((c) => [c.name, ...(c.aliases ?? [])].some((n) => normalize(n).includes(nq)))
      .sort((a, b) => Number(!normalize(a.name).startsWith(nq)) - Number(!normalize(b.name).startsWith(nq)))
      .slice(0, 6)
  }, [query])

  if (value) {
    const city = cities.find((c) => c.id === value.cityId)
    return (
      <div className="ortsschild">
        <div className="flex items-end justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-sign text-[28px] leading-none font-bold">{city ? city.name : stateName.get(value.state)}</p>
            <p className="mt-1.5 text-sm">{city ? stateName.get(value.state) : t('onb.city.stateOnly')}</p>
          </div>
          <button type="button" onClick={() => onChange(undefined)} className="shrink-0 font-semibold underline">
            {t('onb.city.change')}
          </button>
        </div>
      </div>
    )
  }

  if (pickState) {
    return (
      <div>
        <ul className="space-y-2">
          {states.map((s) => (
            <li key={s.code}>
              <button type="button" className={optionClass(false)} onClick={() => onChange({ state: s.code })}>
                <span>
                  {s.name}
                  {s.localName !== s.name && <span className="ml-2 text-sm font-normal text-muted">{s.localName}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setPickState(false)} className="mt-4 font-semibold underline">
          {t('onb.city.search')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('onb.city.placeholder')}
        aria-label={t('onb.city.placeholder')}
        className="w-full rounded-md border-2 border-ink px-4 py-3 text-[17px]"
      />
      {results.length > 0 && (
        <ul className="mt-2 space-y-2">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={optionClass(false)}
                onClick={() => onChange({ state: c.state, cityId: c.id })}
              >
                <span>
                  {c.name}
                  <span className="block text-sm font-normal text-muted">{stateName.get(c.state)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {normalize(query).length >= 2 && results.length === 0 && (
        <p className="mt-3 text-muted">{t('onb.city.none')}</p>
      )}
      <button type="button" onClick={() => setPickState(true)} className="mt-4 font-semibold underline">
        {t('onb.city.notListed')}
      </button>
    </div>
  )
}
