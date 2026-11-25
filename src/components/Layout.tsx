import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { SHOW_DRAFTS } from '../lib/content'
import { t } from '../lib/i18n'

const tabs = [
  { to: '/timeline', label: t('nav.timeline') },
  { to: '/entitled', label: t('nav.entitled') },
  { to: '/people', label: t('nav.people') },
  { to: '/me', label: t('nav.me') },
]

export function Layout() {
  const { pathname } = useLocation()
  // a new screen starts at the top
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  // task pages belong to the Timeline tab
  const active = (to: string) => pathname.startsWith(to) || (to === '/timeline' && pathname.startsWith('/task/'))
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-paper">
      {SHOW_DRAFTS && (
        <p className="border-b border-ink/15 bg-sign-soft px-4 py-1.5 text-center text-sm">{t('draft.banner')}</p>
      )}
      <main className="flex-1 px-5 pt-6 pb-28">
        <Outlet />
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 mx-auto max-w-md border-t-2 border-ink bg-paper">
        <ul className="grid grid-cols-4 gap-1 p-1.5">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={`block rounded-md py-3 text-center text-[15px] font-semibold ${
                  active(tab.to) ? 'bg-sign text-ink' : 'text-muted'
                }`}
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
