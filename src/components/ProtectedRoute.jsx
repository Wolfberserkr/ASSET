import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// `redirectTo`: where a signed-in user with the wrong role goes instead of their home page
// (e.g. an agent opening the schedule builder lands on the published schedule).
// `excludeExecutives`: the executive team (B-07/08/09) is sent to its dashboard.
export default function ProtectedRoute({ allowedRoles, redirectTo, excludeExecutives = false }) {
  const { user, profile, loading, isExecutive } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-brand-bg)' }}>
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--color-brand-cyan)' }}
        />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    if (redirectTo) return <Navigate to={redirectTo} replace />
    // Wrong role — redirect to correct home
    if (profile.role === 'agent' || profile.role === 'pit_manager') return <Navigate to="/dashboard" replace />
    return <Navigate to="/management" replace />
  }

  if (excludeExecutives && isExecutive) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
