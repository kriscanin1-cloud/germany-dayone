import { NavLink, Outlet } from 'react-router-dom'
import { t } from '../lib/i18n'
import { SHOW_DRAFTS } from '../lib/content'

const tabs = [
  { to: '/timeline', label: t('nav.timeline'), icon: '🗓️' },
  { to: '/entitled', label: t('nav.entitled'), icon: '💶' },
  { to: '/people', label: t('nav.people'), icon: '☕' },
  { to: '/me', label: t('nav.me'), icon: '👤' },
]

export function Layout() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-white shadow-sm">
      {SHOW_DRAFTS && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
          {t('draft.banner')}
        </div>
      )}
      <main className="flex-1 px-4 pt-5 pb-24">
        <Outlet />
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-gray-200 bg-white">
        <ul className="grid grid-cols-4">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                    isActive ? 'font-semibold text-brand' : 'text-gray-500'
                  }`
                }
              >
                <span aria-hidden className="text-lg leading-none">
                  {tab.icon}
                </span>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
