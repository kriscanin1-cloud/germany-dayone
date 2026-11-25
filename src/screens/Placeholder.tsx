import { t } from '../lib/i18n'

export function Placeholder({ title, body }: { title: string; body?: string }) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{title}</h1>
      {body && <p className="mt-3 text-gray-600">{body}</p>}
      <p className="mt-6 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">{t('coming')}</p>
    </section>
  )
}
