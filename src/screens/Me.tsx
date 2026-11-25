import { useState } from 'react'
import { analyticsEnabled, isStandalone } from '../lib/analytics'
import { t } from '../lib/i18n'
import { wipe } from '../lib/storage'

export function Me() {
  const [deleted, setDeleted] = useState(false)
  const installed = isStandalone()

  return (
    <section>
      <h1 className="font-sign text-[32px] leading-none font-bold">{t('me.title')}</h1>

      {!installed && <p className="mt-6 border-l-4 border-sign pl-3">{t('install.ios')}</p>}

      <button
        type="button"
        onClick={() => {
          wipe()
          setDeleted(true)
        }}
        className="mt-8 w-full rounded-md border-2 border-alert py-3 font-semibold text-alert"
      >
        {t('me.delete')}
      </button>
      {deleted && <p className="mt-2 text-sm text-muted">{t('me.deleted')}</p>}

      <p className="mt-10 text-sm text-muted">{t('me.disclaimer')}</p>
      <p className="mt-1 text-xs text-muted">
        Installed: {installed ? 'yes' : 'no'}. Analytics: {analyticsEnabled ? 'on' : 'off'}.
      </p>
    </section>
  )
}
