import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Layout } from './components/Layout'
import { t } from './lib/i18n'
import { load } from './lib/storage'
import { Me } from './screens/Me'
import { Onboarding } from './screens/Onboarding'
import { Placeholder } from './screens/Placeholder'
import { TaskDetail } from './screens/TaskDetail'
import { Timeline } from './screens/Timeline'
import { Welcome } from './screens/Welcome'

/** Decided on every visit, not once at start-up: after onboarding "/" goes to the plan. */
function Start() {
  return load().profile ? <Navigate to="/timeline" replace /> : <Welcome />
}

// HashRouter-style URLs (/#/timeline) because GitHub Pages cannot serve SPA routes.
const router = createHashRouter([
  { path: '/', element: <Start /> },
  { path: '/onboarding', element: <Onboarding /> },
  {
    element: <Layout />,
    children: [
      { path: '/timeline', element: <Timeline /> },
      { path: '/task/:id', element: <TaskDetail /> },
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
