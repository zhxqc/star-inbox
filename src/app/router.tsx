import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { LandingPage } from '../pages/LandingPage'
import { PrivacyPage } from '../pages/PrivacyPage'
import {
  ActionCenterRoute,
  AskStarsRoute,
  DashboardRoute,
  ForgottenGemsRoute,
  ImportRoute,
  KnowledgeRoute,
  ReviewRoute,
  SmartTriageRoute,
} from './lazy-pages'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/import', element: <ImportRoute /> },
      { path: '/dashboard', element: <DashboardRoute /> },
      { path: '/review', element: <ReviewRoute /> },
      { path: '/triage', element: <SmartTriageRoute /> },
      { path: '/ask', element: <AskStarsRoute /> },
      { path: '/actions', element: <ActionCenterRoute /> },
      { path: '/gems', element: <ForgottenGemsRoute /> },
      { path: '/knowledge', element: <KnowledgeRoute /> },
      { path: '/privacy', element: <PrivacyPage /> },
    ],
  },
])
