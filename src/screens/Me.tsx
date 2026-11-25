import { useState } from 'react'
import { analyticsEnabled, isStandalone } from '../lib/analytics'
import { t } from '../lib/i18n'
import { wipe } from '../lib/storage'

export function Me() {
  const [deleted, setDeleted] = useState(false)
  const installed = isStandalone()

  return (
    <section>
      <h1 className="text-2xl font-bold">{t('me.title')}</h1>

      {!installed && (
        <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{t('install.ios')}</p>
      )}

      <button
        type="button"
        onClick={() => {
          wipe()
          setDeleted(true)
        }}
        className="mt-6 w-full rounded-xl border border-red-200 py-3 font-medium text-red-700"
      >
        {t('me.delete')}
      </button>
      {deleted && <p className="mt-2 text-sm text-gray-600">{t('me.deleted')}</p>}

      <p className="mt-8 text-xs text-gray-500">{t('me.disclaimer')}</p>
      <p className="mt-1 text-xs text-gray-400">
        Installed: {installed ? 'yes' : 'no'} · Analytics: {analyticsEnabled ? 'on' : 'off'}
      </p>
    </section>
  )
}
