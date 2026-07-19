import { Navigate, Outlet } from 'react-router-dom'
import { useAuth, DRILL_ROLES } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-brand-bg)' }}>
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--color-brand-gold)' }}
        />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    // Wrong role — redirect to correct home
    if (DRILL_ROLES.includes(profile.role)) return <Navigate to="/dashboard" replace />
    return <Navigate to="/management" replace />
  }

  return <Outlet />
}
