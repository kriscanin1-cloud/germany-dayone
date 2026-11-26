import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import { t, type Key as TKey } from '../lib/i18n'
import { INTEREST_LABELS, type Taste } from '../lib/personal'
import { load, update } from '../lib/storage'

type Key = keyof Taste
const QUESTIONS: { key: Key; options: string[] }[] = [
  { key: 'diet', options: ['all', 'vegetarian', 'vegan', 'halal', 'no_pork'] },
  { key: 'alcohol', options: ['yes', 'no'] },
  { key: 'company', options: ['alone', 'partner', 'kids'] },
  { key: 'pace', options: ['calm', 'mixed', 'active'] },
  { key: 'budget', options: ['free', 'low', 'any'] },
]

/** Discover → Personalise: a short taste survey that adds to the person's portrait. Stays on this device. */
export function Personalise() {
  const navigate = useNavigate()
  const start = load()
  const [taste, setTaste] = useState<Taste>(start.taste ?? {})
  const [interests, setInterests] = useState<string[]>(start.me?.interests ?? [])

  const pick = (key: Key, v: string) => setTaste((cur) => ({ ...cur, [key]: cur[key] === v ? undefined : v }))
  const toggle = (v: string) => setInterests((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))

  const saveAndBack = () => {
    update((s) => ({ ...s, taste, me: { ...s.me, interests } }))
    // only that it happened — never the answers (diet and alcohol can reveal religion)
    track('taste_saved', {})
    navigate('/timeline?view=discover', { replace: true })
  }

  return (
    <section>
      <Link to="/timeline?view=discover" className="text-sm font-semibold underline">
        {t('taste.back')}
      </Link>
      <h1 className="mt-3 font-sign text-[32px] leading-none font-bold">{t('taste.title')}</h1>
      <p className="mt-3 text-muted">{t('taste.intro')}</p>

      {QUESTIONS.map((q) => (
        <fieldset key={q.key} className="mt-6">
          <legend className="font-semibold">{t(`taste.${q.key}` as TKey)}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {q.options.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={taste[q.key] === o}
                onClick={() => pick(q.key, o)}
                className={`rounded-md border-2 px-3 py-1.5 text-[15px] font-semibold ${
                  taste[q.key] === o ? 'border-ink bg-ink text-paper' : 'border-ink/20'
                }`}
              >
                {t(`taste.${q.key}.${o}` as TKey)}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="mt-6">
        <legend className="font-semibold">{t('taste.interests')}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTEREST_LABELS.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={interests.includes(o)}
              onClick={() => toggle(o)}
              className={`rounded-md border-2 px-3 py-1.5 text-[15px] font-semibold ${
                interests.includes(o) ? 'border-ink bg-ink text-paper' : 'border-ink/20'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="mt-6 border-l-4 border-sign pl-3 text-sm">{t('taste.private')}</p>
      <button type="button" onClick={saveAndBack} className="mt-5 w-full rounded-md bg-ink py-3 font-semibold text-paper">
        {t('taste.save')}
      </button>
    </section>
  )
}
