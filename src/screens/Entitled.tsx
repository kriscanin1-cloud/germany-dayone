import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { track } from '../lib/analytics'
import { scenario, SHOW_DRAFTS } from '../lib/content'
import { applies } from '../lib/engine'
import { t } from '../lib/i18n'
import { toProfile } from '../lib/questionnaire'
import { load } from '../lib/storage'
import type { Entitlement, EntitlementCategory, Profile } from '../lib/types'

const SAMPLE: Profile = {
  purpose: 'study', eu: false, citizenship: 'other', status: 'national_visa', arrival: '2026-11-20', state: 'DE-BE', cityId: 'berlin',
}
const CATEGORIES: (EntitlementCategory | 'all')[] = ['all', 'money', 'discount', 'learning', 'help']

export function Entitled() {
  const saved = load()
  const profile =
    saved.profile && !saved.profile.citizenship && saved.answers ? toProfile(saved.answers) : (saved.profile ?? SAMPLE)
  const [cat, setCat] = useState<EntitlementCategory | 'all'>('all')

  const { mine, other } = useMemo(() => {
    const visible = scenario.entitlements.filter((e) => SHOW_DRAFTS || e.status === 'verified')
    return {
      mine: visible.filter((e) => applies(e.appliesTo, profile)),
      other: visible.filter((e) => !applies(e.appliesTo, profile)),
    }
  }, [profile])
  const inCat = (e: Entitlement) => cat === 'all' || e.category === cat
  const count = (c: EntitlementCategory | 'all') => mine.filter((e) => c === 'all' || e.category === c).length

  return (
    <section>
      <h1 className="font-sign text-[32px] leading-none font-bold">{t('entitled.title')}</h1>
      <p className="mt-3 text-muted">{t('entitled.intro')}</p>
      {!saved.profile && (
        <Link to="/onboarding" className="mt-3 inline-block rounded-md bg-ink px-4 py-2.5 font-semibold text-paper">
          {t('timeline.cta')}
        </Link>
      )}

      <div role="tablist" aria-label={t('entitled.filter')} className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={`shrink-0 rounded-md border-2 px-3 py-1.5 text-[15px] font-semibold ${
              cat === c ? 'border-ink bg-ink text-paper' : 'border-ink/20'
            }`}
          >
            {t(`entitled.cat.${c}`)} <span className={cat === c ? 'text-sign' : 'text-muted'}>{count(c)}</span>
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {mine.filter(inCat).map((e) => (
          <Card key={e.id} e={e} />
        ))}
      </ul>

      {other.filter(inCat).length > 0 && (
        <details className="mt-8 border-t-2 border-ink pt-3">
          <summary className="cursor-pointer font-sign text-xl font-bold">
            {t('entitled.other', { n: String(other.filter(inCat).length) })}
          </summary>
          <p className="mt-2 text-sm text-muted">{t('entitled.otherIntro')}</p>
          <ul className="mt-3 space-y-3">
            {other.filter(inCat).map((e) => (
              <li key={e.id} className="border-b border-ink/15 pb-3">
                <p className="font-semibold">{e.title.en}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {e.who.en} {e.law && <span className="whitespace-nowrap">({e.law})</span>}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-8 text-sm text-muted">{t('me.disclaimer')}</p>
    </section>
  )
}

function Card({ e }: { e: Entitlement }) {
  return (
    <li className="rounded-md border-2 border-ink/20">
      <details onToggle={(ev) => (ev.currentTarget as HTMLDetailsElement).open && track('entitlement_opened', { id: e.id })}>
        <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
          <p className="text-xs font-semibold text-muted">
            {t(`entitled.cat.${e.category}`)}
            {e.law && <span> · {e.law}</span>}
          </p>
          <p className="mt-0.5 text-[17px] leading-snug font-semibold">{e.title.en}</p>
          <p className="mt-1 inline-block bg-sign px-1.5 text-[15px] font-semibold">{e.valueHint.en}</p>
          <p className="mt-1.5 text-sm text-muted">{e.who.en}</p>
          <p className="mt-2 text-sm font-semibold underline">{t('entitled.more')}</p>
        </summary>
        <div className="border-t border-ink/15 px-4 pt-3 pb-4">
          {e.conditions.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-[15px]">
              {e.conditions.map((c, i) => (
                <li key={i}>{c.en}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-l-4 border-sign pl-3 text-[15px]">
            <span className="font-semibold">{t('entitled.how')} </span>
            {e.howTo.en}
          </p>
          {e.links.length > 0 && (
            <ul className="mt-3 space-y-1">
              {e.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer" className="text-[15px] font-semibold underline">
                    {l.label.en} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            {e.status === 'verified' ? t('task.checked', { date: e.lastVerified }) : t('task.draftNote')}
          </p>
        </div>
      </details>
    </li>
  )
}
