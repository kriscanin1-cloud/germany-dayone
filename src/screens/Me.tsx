import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { analyticsEnabled, isStandalone, track } from '../lib/analytics'
import { t } from '../lib/i18n'
import { load, wipe } from '../lib/storage'

export function Me() {
  const navigate = useNavigate()
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const installed = isStandalone()
  const saved = load()

  return (
    <section>
      <h1 className="font-sign text-[32px] leading-none font-bold">{t('me.title')}</h1>

      {!installed && <p className="mt-6 border-l-4 border-sign pl-3">{t('install.ios')}</p>}

      {saved.profile && (
        <Link to="/onboarding" className="mt-8 block rounded-md border-2 border-ink py-3 text-center font-semibold">
          {t('me.edit')}
        </Link>
      )}

      <button
        type="button"
        onClick={() => {
          const id = load().anonId
          track('data_deleted')
          wipe()
          setDeletedId(id)
        }}
        className="mt-3 w-full rounded-md border-2 border-alert py-3 font-semibold text-alert"
      >
        {t('me.delete')}
      </button>
      {deletedId && (
        <div className="mt-3 text-sm">
          <p>{t('me.deleted')}</p>
          <p className="mt-1 text-muted">
            {t('me.id')} <span className="break-all">{deletedId}</span>
          </p>
          <button type="button" onClick={() => navigate('/')} className="mt-2 font-semibold underline">
            {t('welcome.cta')}
          </button>
        </div>
      )}

      <p className="mt-10 text-sm text-muted">{t('me.disclaimer')}</p>
      <p className="mt-1 text-xs text-muted">
        Installed: {installed ? 'yes' : 'no'}. Analytics: {analyticsEnabled ? 'on' : 'off'}.
      </p>
    </section>
  )
}
