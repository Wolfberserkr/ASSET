import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { computeDecay, decayDismissKey } from '../lib/decayUtils'
import {
  Shield, LayoutDashboard, KeyRound, LogOut,
  CheckSquare, BarChart2, FileText, ClipboardList, BookOpen,
  ChevronRight, PlayCircle, GraduationCap, Menu, X, Library, Bell,
} from 'lucide-react'

const REQUIRED = 20

function prevMonthKey() {
  const d = new Date()
  const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()
  const m = String(d.getMonth() === 0 ? 12 : d.getMonth()).padStart(2, '0')
  return `${y}-${m}`
}

function prevMonthLabel() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

function loadDismissed() {
  try { return JSON.parse(localStorage.getItem('notif_dismissed') ?? '{}') } catch { return {} }
}

function notifKey(userId) {
  return `${prevMonthKey()}_${userId}`
}

const agentNav = [
  { to: '/dashboard',       label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/drill',           label: 'Drill',           icon: PlayCircle },
  { to: '/practice',        label: 'Practice',        icon: GraduationCap },
  { to: '/resources',       label: 'Resources',       icon: Library },
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
  const [notifOpen,    setNotifOpen]    = useState(false)
  const [missed,       setMissed]       = useState([])
  const [decayAlerts,  setDecayAlerts]  = useState([])
  const [dismissed,    setDismissed]    = useState(loadDismissed)

  useEffect(() => {
    if (!isManagement) return
    const now = new Date()
    const firstLast  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const firstThis  = new Date(now.getFullYear(), now.getMonth(),     1).toISOString()
    const cutoff28   = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
    Promise.all([
      supabase.from('sessions').select('user_id').eq('status', 'completed')
        .gte('completed_at', firstLast).lt('completed_at', firstThis),
      supabase.from('users').select('id, name, employee_id').eq('role', 'agent').eq('is_active', true),
      supabase.from('sessions').select('user_id, score, completed_at')
        .eq('status', 'completed').gte('completed_at', cutoff28),
    ]).then(([sRes, uRes, decayRes]) => {
      const agents = uRes.data ?? []
      const counts = {}
      for (const s of sRes.data ?? []) counts[s.user_id] = (counts[s.user_id] ?? 0) + 1
      setMissed(
        agents.filter(u => (counts[u.id] ?? 0) < REQUIRED)
              .map(u => ({ ...u, count: counts[u.id] ?? 0 }))
      )
      const decayMap = computeDecay(decayRes.data ?? [])
      setDecayAlerts(
        agents.filter(u => decayMap[u.id]?.isDecaying)
              .map(u => ({ ...u, ...decayMap[u.id] }))
      )
    })
  }, [isManagement])

  const dismissOne = (userId) => {
    const next = { ...dismissed, [notifKey(userId)]: true }
    setDismissed(next)
    localStorage.setItem('notif_dismissed', JSON.stringify(next))
  }

  const dismissDecay = (userId) => {
    const next = { ...dismissed, [decayDismissKey(userId)]: true }
    setDismissed(next)
    localStorage.setItem('notif_dismissed', JSON.stringify(next))
  }

  const dismissAll = () => {
    const next = { ...dismissed }
    missed.forEach(a => { next[notifKey(a.id)] = true })
    decayAlerts.forEach(a => { next[decayDismissKey(a.id)] = true })
    setDismissed(next)
    localStorage.setItem('notif_dismissed', JSON.stringify(next))
  }

  const undismissed      = missed.filter(a => !dismissed[notifKey(a.id)])
  const undismissedDecay = decayAlerts.filter(a => !dismissed[decayDismissKey(a.id)])

  const navLinks = isManagement ? mgmtNav : agentNav
  const pageKey = useRef(0)
  const prevPath = useRef(location.pathname)

  // Increment key on route change to re-trigger page-enter animation
  if (location.pathname !== prevPath.current) {
    pageKey.current += 1
    prevPath.current = location.pathname
  }

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Lock body scroll when mobile sidebar is open — deferred to avoid scroll jump before animation
  useEffect(() => {
    if (sidebarOpen) {
      const t = setTimeout(() => { document.body.style.overflow = 'hidden' }, 0)
      return () => { clearTimeout(t); document.body.style.overflow = '' }
    } else {
      document.body.style.overflow = ''
    }
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
        <span className="text-sm font-bold" style={{ color: 'var(--color-brand-text)' }}>A.S.S.E.T</span>
      </div>

      {/* Mobile overlay — always rendered, fades in/out via CSS */}
      <div
        className="fixed inset-0 z-40 md:hidden transition-opacity duration-200"
        style={{
          background: 'rgba(0,0,0,0.6)',
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? 'auto' : 'none',
        }}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 shrink-0 flex flex-col h-full md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 sidebar-open' : '-translate-x-full sidebar-closed'
        }`}
        style={{ background: 'var(--color-brand-surface)', borderRight: '1px solid var(--color-brand-border)' }}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
          <Shield size={20} style={{ color: 'var(--color-brand-gold)' }} />
          <div className="flex-1">
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-brand-text)' }}>A.S.S.E.T</p>
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

        {/* Notification bell — management only */}
        {isManagement && (
          <div className="px-3 pb-2 relative">
            <button
              onClick={() => setNotifOpen(o => !o)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ color: (undismissed.length + undismissedDecay.length) ? 'var(--color-brand-gold)' : 'var(--color-brand-muted)' }}
              aria-label="Notifications"
            >
              <span className="relative">
                <Bell size={16} />
                {(undismissed.length + undismissedDecay.length) > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{ background: '#fca5a5', color: '#1a0000' }}>
                    {undismissed.length + undismissedDecay.length}
                  </span>
                )}
              </span>
              <span>Notifications</span>
            </button>

            {notifOpen && (
              <>
                {/* Click-outside overlay */}
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />

                {/* Panel — floats to the right of sidebar on md+, above button on mobile */}
                <div className="fixed z-50 w-80 rounded-xl shadow-2xl overflow-hidden
                  left-4 bottom-20 md:left-[14.5rem] md:bottom-16"
                  style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)' }}>

                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>Notifications</p>
                      <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>{prevMonthLabel()} recertification</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(undismissed.length + undismissedDecay.length) > 1 && (
                        <button onClick={dismissAll}
                          className="text-xs px-2 py-1 rounded-md transition-opacity hover:opacity-70"
                          style={{ color: 'var(--color-brand-muted)', border: '1px solid var(--color-brand-border)' }}>
                          Clear all
                        </button>
                      )}
                      <button onClick={() => setNotifOpen(false)}
                        style={{ color: 'var(--color-brand-muted)' }} aria-label="Close">
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="max-h-80 overflow-y-auto">
                    {undismissed.length === 0 && undismissedDecay.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--color-brand-muted)' }}>
                        No new notifications
                      </p>
                    ) : (
                      <>
                        {/* Missed last month */}
                        {undismissed.length > 0 && (
                          <>
                            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                              style={{ color: 'var(--color-brand-muted)' }}>Missed Target</p>
                            {undismissed.map((a, i) => (
                              <div key={a.id} className="flex items-start gap-3 px-4 py-3"
                                style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                                  style={{ background: '#2a0a0a', color: '#fca5a5' }}>
                                  {a.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium" style={{ color: 'var(--color-brand-text)' }}>{a.name}</p>
                                  <p className="text-xs mt-0.5" style={{ color: '#fca5a5' }}>
                                    Missed {prevMonthLabel()} target — {a.count}/{REQUIRED} sessions
                                  </p>
                                </div>
                                <button onClick={() => dismissOne(a.id)}
                                  className="shrink-0 p-1 rounded hover:opacity-60 transition-opacity mt-0.5"
                                  style={{ color: 'var(--color-brand-muted)' }} aria-label="Dismiss">
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </>
                        )}

                        {/* Score decay */}
                        {undismissedDecay.length > 0 && (
                          <>
                            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                              style={{ color: 'var(--color-brand-muted)' }}>Score Decay</p>
                            {undismissedDecay.map(a => (
                              <div key={a.id} className="flex items-start gap-3 px-4 py-3"
                                style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                                  style={{ background: '#1a0f1f', color: '#c084fc' }}>
                                  {a.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium" style={{ color: 'var(--color-brand-text)' }}>{a.name}</p>
                                  <p className="text-xs mt-0.5" style={{ color: '#c084fc' }}>
                                    Score down {a.dropPct}% over 2 weeks ({a.priorAvg} → {a.recentAvg})
                                  </p>
                                </div>
                                <button onClick={() => dismissDecay(a.id)}
                                  className="shrink-0 p-1 rounded hover:opacity-60 transition-opacity mt-0.5"
                                  style={{ color: 'var(--color-brand-muted)' }} aria-label="Dismiss">
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

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
              {profile?.employee_id?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate font-mono" style={{ color: 'var(--color-brand-text)' }}>
                {profile?.employee_id ?? '—'}
              </p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)]"
            style={{ color: 'var(--color-brand-muted)' }}
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

        <div key={pageKey.current} className="page-enter relative z-10 max-w-5xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
