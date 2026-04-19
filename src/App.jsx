import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Auth — keep eager (first paint)
import Login from './pages/Login'

// Agent pages — lazy loaded
const AgentDashboard = lazy(() => import('./pages/agent/Dashboard'))
const ChangePassword = lazy(() => import('./pages/agent/ChangePassword'))
const DrillSession   = lazy(() => import('./pages/agent/DrillSession'))
const Results        = lazy(() => import('./pages/agent/Results'))
const History        = lazy(() => import('./pages/agent/History'))
const Practice       = lazy(() => import('./pages/agent/Practice'))
const Resources      = lazy(() => import('./pages/agent/Resources'))
const ResourceDetail = lazy(() => import('./pages/agent/ResourceDetail'))

// Management pages — lazy loaded
const TeamDashboard  = lazy(() => import('./pages/management/TeamDashboard'))
const AgentDetail    = lazy(() => import('./pages/management/AgentDetail'))
const Completion     = lazy(() => import('./pages/management/Completion'))
const WeakAreas      = lazy(() => import('./pages/management/WeakAreas'))
const QuestionStats  = lazy(() => import('./pages/management/QuestionStats'))
const AuditLog       = lazy(() => import('./pages/management/AuditLog'))
const QuestionEditor = lazy(() => import('./pages/management/QuestionEditor'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="w-6 h-6 rounded-full border-2 border-[var(--color-brand-gold)] border-t-transparent animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Agent routes */}
            <Route element={<ProtectedRoute allowedRoles={['agent']} />}>
              <Route path="/dashboard"          element={<AgentDashboard />} />
              <Route path="/change-password"    element={<ChangePassword />} />
              <Route path="/drill"              element={<DrillSession />} />
              <Route path="/results/:sessionId" element={<Results />} />
              <Route path="/history"              element={<History />} />
              <Route path="/practice"           element={<Practice />} />
              <Route path="/resources"          element={<Resources />} />
              <Route path="/resources/:gameId"  element={<ResourceDetail />} />
            </Route>

            {/* Management routes */}
            <Route element={<ProtectedRoute allowedRoles={['supervisor', 'director']} />}>
              <Route path="/management"                element={<TeamDashboard />} />
              <Route path="/management/agent/:id"      element={<AgentDetail />} />
              <Route path="/management/completion"     element={<Completion />} />
              <Route path="/management/weak-areas"     element={<WeakAreas />} />
              <Route path="/management/question-stats" element={<QuestionStats />} />
              <Route path="/management/audit-log"      element={<AuditLog />} />
              <Route path="/management/questions"      element={<QuestionEditor />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </HashRouter>
  )
}
