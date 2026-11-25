import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Layout } from './components/Layout'
import { t } from './lib/i18n'
import { load } from './lib/storage'
import { Me } from './screens/Me'
import { Placeholder } from './screens/Placeholder'
import { Timeline } from './screens/Timeline'
import { Welcome } from './screens/Welcome'

// HashRouter-style URLs (/#/timeline) because GitHub Pages cannot serve SPA routes.
const router = createHashRouter([
  { path: '/', element: load().profile ? <Navigate to="/timeline" replace /> : <Welcome /> },
  { path: '/onboarding', element: <Placeholder title="Onboarding" body="5–6 quick questions build your plan." /> },
  {
    element: <Layout />,
    children: [
      { path: '/timeline', element: <Timeline /> },
      { path: '/entitled', element: <Placeholder title={t('entitled.title')} /> },
      { path: '/people', element: <Placeholder title={t('people.title')} body={t('people.body')} /> },
      { path: '/me', element: <Me /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
