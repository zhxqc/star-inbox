import { lazy, Suspense, type ReactNode } from 'react'

const ImportPage = lazy(() =>
  import('../pages/ImportPage').then((module) => ({
    default: module.ImportPage,
  })),
)
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const ReviewPage = lazy(() =>
  import('../pages/ReviewPage').then((module) => ({
    default: module.ReviewPage,
  })),
)
const SmartTriagePage = lazy(() =>
  import('../pages/SmartTriagePage').then((module) => ({
    default: module.SmartTriagePage,
  })),
)
const AskStarsPage = lazy(() =>
  import('../pages/AskStarsPage').then((module) => ({
    default: module.AskStarsPage,
  })),
)
const ActionCenterPage = lazy(() =>
  import('../pages/ActionCenterPage').then((module) => ({
    default: module.ActionCenterPage,
  })),
)
const ForgottenGemsPage = lazy(() =>
  import('../pages/ForgottenGemsPage').then((module) => ({
    default: module.ForgottenGemsPage,
  })),
)
const KnowledgePage = lazy(() =>
  import('../pages/KnowledgePage').then((module) => ({
    default: module.KnowledgePage,
  })),
)

function RouteBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          className="page-shell grid min-h-[65vh] place-items-center"
          role="status"
        >
          <span className="import-loader-orbit" aria-label="正在加载页面">
            <span>★</span>
          </span>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export function ImportRoute() {
  return (
    <RouteBoundary>
      <ImportPage />
    </RouteBoundary>
  )
}

export function DashboardRoute() {
  return (
    <RouteBoundary>
      <DashboardPage />
    </RouteBoundary>
  )
}

export function ReviewRoute() {
  return (
    <RouteBoundary>
      <ReviewPage />
    </RouteBoundary>
  )
}

export function SmartTriageRoute() {
  return (
    <RouteBoundary>
      <SmartTriagePage />
    </RouteBoundary>
  )
}

export function AskStarsRoute() {
  return (
    <RouteBoundary>
      <AskStarsPage />
    </RouteBoundary>
  )
}

export function ActionCenterRoute() {
  return (
    <RouteBoundary>
      <ActionCenterPage />
    </RouteBoundary>
  )
}

export function ForgottenGemsRoute() {
  return (
    <RouteBoundary>
      <ForgottenGemsPage />
    </RouteBoundary>
  )
}

export function KnowledgeRoute() {
  return (
    <RouteBoundary>
      <KnowledgePage />
    </RouteBoundary>
  )
}
