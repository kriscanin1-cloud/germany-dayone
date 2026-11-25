import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'

export function Welcome() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-paper px-6 pt-14 pb-8">
      {/* Hero: a town-entrance sign that says Germany, day one */}
      <div className="ortsschild" aria-hidden>
        <div className="px-5 pt-5 pb-4">
          <p className="font-sign text-[46px] leading-none font-bold tracking-tight">Deutschland</p>
          <p className="mt-3 font-sign text-xl leading-none font-semibold">Tag 1</p>
        </div>
      </div>

      <h1 className="mt-10 font-sign text-[32px] leading-[1.1] font-bold">{t('welcome.title')}</h1>
      <p className="mt-4 text-lg text-muted">{t('welcome.body')}</p>

      <div className="safe-bottom mt-auto pt-10">
        <Link
          to="/onboarding"
          className="block rounded-md bg-ink py-4 text-center text-lg font-semibold text-paper"
        >
          {t('welcome.cta')}
        </Link>
        <p className="mt-4 text-center text-sm text-muted">{t('me.disclaimer')}</p>
      </div>
    </div>
  )
}
