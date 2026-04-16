import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Shield, LayoutDashboard, KeyRound, LogOut,
  CheckSquare, BarChart2, FileText, ClipboardList, BookOpen,
  ChevronRight, PlayCircle, GraduationCap, Menu, X,
} from 'lucide-react'

const agentNav = [
  { to: '/dashboard',       label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/drill',           label: 'Drill',           icon: PlayCircle },
  { to: '/practice',        label: 'Practice',        icon: GraduationCap },
  { to: '/history',         label: 'My History',      icon: FileText },
  { to: '/change-password', label: 'Change Password', icon: KeyRound },
]

const mgmtNav = [
  { to: '/management',                  label: 'Team Dashboard',    icon: LayoutDashboard },
  { to: '/management/completion',       label: 'Completion Tracker',icon: CheckSquare },
  { to: '/management/weak-areas',       label: 'Weak Areas',        icon: BarChart2 },
  { to: '/management/question-stats',   label: 'Question Stats',    icon: ClipboardList },
  { to: '/management/questions',        label: 'Question Editor',   icon: BookOpen },
  { to: '/management/audit-log',        label: 'Audit Log',         icon: FileText },
]

function NavItem({ to, label, icon: Icon, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/management' || to === '/dashboard'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)] ${
          isActive ? 'bg-[var(--color-brand-card)] text-[var(--color-brand-gold)]' : ''
        }`
      }
      style={({ isActive }) => ({
        color: isActive ? 'var(--color-brand-gold)' : 'var(--color-brand-muted)',
      })}
    >
      {({ isActive }) => (
        <>
          <Icon size={16} />
          <span>{label}</span>
          {isActive && <ChevronRight size={14} className="ml-auto" />}
        </>
      )}
    </NavLink>
  )
}

export default function Layout({ children, bg }) {
  const { profile, logout, isManagement } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navLinks = isManagement ? mgmtNav : agentNav

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-brand-bg)' }}>

      {/* Mobile top bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 md:hidden"
        style={{ background: 'var(--color-brand-surface)', borderBottom: '1px solid var(--color-brand-border)' }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)]"
          style={{ color: 'var(--color-brand-muted)' }}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <Shield size={18} style={{ color: 'var(--color-brand-gold)' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--color-brand-text)' }}>Stellaris</span>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 shrink-0 flex flex-col h-full transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--color-brand-surface)', borderRight: '1px solid var(--color-brand-border)' }}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
          <Shield size={20} style={{ color: 'var(--color-brand-gold)' }} />
          <div className="flex-1">
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-brand-text)' }}>Stellaris</p>
            <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Surveillance</p>
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)]"
            style={{ color: 'var(--color-brand-muted)' }}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" role="navigation" aria-label="Main navigation">
          {navLinks.map(link => (
            <NavItem key={link.to} {...link} onClick={() => setSidebarOpen(false)} />
          ))}
        </nav>

        {/* User footer */}
        <div
          className="p-3"
          style={{ borderTop: '1px solid var(--color-brand-border)' }}
        >
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'var(--color-brand-gold)', color: '#0b0f1a' }}
            >
              {profile?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-brand-text)' }}>
                {profile?.name ?? '—'}
              </p>
              <p className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                {profile?.employee_id}
              </p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)]"
            style={{ color: 'var(--color-brand-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-brand-danger)'; e.currentTarget.style.background = '#1f0a0a' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-brand-muted)'; e.currentTarget.style.background = 'transparent' }}
            aria-label="Sign out"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative pt-14 md:pt-0">

        {/* Optional background layer (e.g. CircuitBackground) — fixed so it
            stays put while the page content scrolls */}
        {bg && (
          <div
            aria-hidden="true"
            className="hidden md:block"
            style={{
              position: 'fixed',
              top: 0, right: 0, bottom: 0,
              left: '14rem',
              zIndex: 0,
              pointerEvents: 'none',
              opacity: 0.55,
            }}
          >
            {bg}
          </div>
        )}

        <div className="relative z-10 max-w-5xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
