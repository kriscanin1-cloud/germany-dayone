import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { track } from '../lib/analytics'
import { t } from '../lib/i18n'

/**
 * Shown instead of the router's default error page, which prints the raw error.
 * The person gets a way out; we log only the error's type, never its message (it may contain data).
 */
export function ErrorScreen() {
  const error = useRouteError()
  useEffect(() => {
    track('app_error', { kind: error instanceof Error ? error.name : typeof error })
    if (import.meta.env.DEV) console.error(error)
  }, [error])
  return (
    <main className="mx-auto max-w-lg px-5 pt-16">
      <div className="ortsschild inline-block px-4 py-2">
        <p className="font-sign text-2xl font-bold">{t('error.sign')}</p>
      </div>
      <h1 className="mt-6 font-sign text-[30px] leading-tight font-bold">{t('error.title')}</h1>
      <p className="mt-3">{t('error.body')}</p>
      <a href="#/timeline" onClick={() => window.location.reload()} className="mt-6 inline-block rounded-md bg-ink px-5 py-3 font-semibold text-paper">
        {t('error.cta')}
      </a>
    </main>
  )
}
