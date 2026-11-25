import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'

export function Welcome() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-between bg-brand px-6 pt-16 pb-10 text-white">
      <div>
        <img src="icons/icon-192.png" alt="" className="h-16 w-16 rounded-2xl" />
        <h1 className="mt-8 text-3xl leading-tight font-bold">{t('welcome.title')}</h1>
        <p className="mt-4 text-base text-white/85">{t('welcome.body')}</p>
      </div>
      <div className="safe-bottom">
        <Link
          to="/onboarding"
          className="block rounded-xl bg-accent py-3.5 text-center font-semibold text-gray-900"
        >
          {t('welcome.cta')}
        </Link>
        <p className="mt-4 text-center text-xs text-white/70">{t('me.disclaimer')}</p>
      </div>
    </div>
  )
}
