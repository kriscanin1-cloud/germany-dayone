import { t } from '../lib/i18n'

export function Placeholder({ title, body }: { title: string; body?: string }) {
  return (
    <section>
      <h1 className="font-sign text-[32px] leading-none font-bold">{title}</h1>
      {body && <p className="mt-4 text-lg text-muted">{body}</p>}
      <p className="mt-6 border-l-4 border-sign pl-3 text-muted">{t('coming')}</p>
    </section>
  )
}
