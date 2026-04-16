import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Auth
import Login from './pages/Login'

// Agent pages
import AgentDashboard   from './pages/agent/Dashboard'
import ChangePassword   from './pages/agent/ChangePassword'
import DrillSession     from './pages/agent/DrillSession'
import Results          from './pages/agent/Results'
import History          from './pages/agent/History'
import Practice         from './pages/agent/Practice'

// Management pages
import TeamDashboard  from './pages/management/TeamDashboard'
import AgentDetail    from './pages/management/AgentDetail'
import Completion     from './pages/management/Completion'
import WeakAreas      from './pages/management/WeakAreas'
import QuestionStats  from './pages/management/QuestionStats'
import AuditLog       from './pages/management/AuditLog'
import QuestionEditor from './pages/management/QuestionEditor'

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Agent routes */}
          <Route element={<ProtectedRoute allowedRoles={['agent']} />}>
            <Route path="/dashboard"          element={<AgentDashboard />} />
            <Route path="/change-password"    element={<ChangePassword />} />
            <Route path="/drill"              element={<DrillSession />} />
            <Route path="/results/:sessionId" element={<Results />} />
            <Route path="/history"            element={<History />} />
            <Route path="/practice"           element={<Practice />} />
          </Route>

          {/* Management routes */}
          <Route element={<ProtectedRoute allowedRoles={['supervisor', 'director']} />}>
            <Route path="/management"              element={<TeamDashboard />} />
            <Route path="/management/agent/:id"    element={<AgentDetail />} />
            <Route path="/management/completion"   element={<Completion />} />
            <Route path="/management/weak-areas"   element={<WeakAreas />} />
            <Route path="/management/question-stats" element={<QuestionStats />} />
            <Route path="/management/audit-log"    element={<AuditLog />} />
            <Route path="/management/questions"    element={<QuestionEditor />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
