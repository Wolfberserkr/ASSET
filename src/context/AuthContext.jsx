import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

const AuthContext = createContext(null)

const SESSION_TIMEOUT_MS = 30 * 60 * 1000  // 30 minutes inactivity
const ACTIVITY_EVENTS     = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
const FORCE_LOGOUT_POLL_MS = 45 * 1000     // how often to check for an admin force-logout

// Decode a JWT's `iat` (issued-at, seconds) without a library or an
// auth.* call — pure base64url parse. Used to compare the current
// session's start against force_logout_at. Returns null on any failure.
function jwtIat(token) {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const iat = JSON.parse(json)?.iat
    return typeof iat === 'number' ? iat : null
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)   // Supabase auth user
  const [profile, setProfile] = useState(null)   // public.users row
  const [loading, setLoading] = useState(true)

  const navigate           = useNavigate()
  const timeoutRef         = useRef(null)
  const profileRef         = useRef(null)
  const pendingLogoutsRef  = useRef(0)   // counts in-flight logout()-initiated signOut() calls
  const sessionIatRef      = useRef(null) // issued-at of the current session's access token

  // ── Fetch profile from public.users ──────────────────────────
  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser) { setProfile(null); return }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error) {
      console.error('Profile fetch error:', error)
      setProfile(null)
      return
    }

    setProfile(data)
    profileRef.current = data
  }, [])

  // ── Session timeout ───────────────────────────────────────────
  const resetTimeout = useCallback(() => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      logout('timeout')
    }, SESSION_TIMEOUT_MS)
  }, []) // eslint-disable-line

  const startActivityTracking = useCallback(() => {
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimeout, { passive: true }))
    resetTimeout()
  }, [resetTimeout])

  const stopActivityTracking = useCallback(() => {
    ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimeout))
    clearTimeout(timeoutRef.current)
  }, [resetTimeout])

  // ── Bootstrap on mount ───────────────────────────────────────
  // `loading` is a cold-boot gate only: it stays true until the first auth
  // event (INITIAL_SESSION) tells us whether a session exists. After that,
  // SIGNED_IN / SIGNED_OUT / USER_UPDATED update user+profile in place
  // without flipping loading back to true — this prevents ProtectedRoute and
  // Login from flashing the dark loading screen mid-navigation.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED only rotates the JWT — profile and role are unchanged.
      if (event === 'TOKEN_REFRESHED') return

      // Guard against a background signOut() firing SIGNED_OUT AFTER a new
      // sign-in has already raced ahead. logout() bumps pendingLogoutsRef
      // before kicking off its fire-and-forget signOut(); we decrement here
      // and bail out so the freshly-authenticated state is preserved.
      //
      // CRITICAL: this listener must NOT be async and must NOT call any
      // supabase.auth.* method (getSession, refreshSession, etc.). Auth
      // methods invoked inside an onAuthStateChange listener try to acquire
      // the same internal lock the auth client is currently holding, which
      // deadlocks the entire auth state machine and freezes the next
      // signInWithPassword() forever — exactly the "Signing in…" hang we
      // saw in production after an expired-session SIGNED_OUT fired on boot.
      if (event === 'SIGNED_OUT' && pendingLogoutsRef.current > 0) {
        pendingLogoutsRef.current -= 1
        return
      }

      const authUser = session?.user ?? null
      // Capture the session start (pure JWT parse, no auth.* call — safe in
      // this listener). TOKEN_REFRESHED returns early above, so this holds the
      // ORIGINAL sign-in time; a force-logout stamped after it still fires even
      // if the token later refreshes.
      sessionIatRef.current = session?.access_token ? jwtIat(session.access_token) : null
      setUser(authUser)
      fetchProfile(authUser).finally(() => setLoading(false))

      if (authUser) {
        startActivityTracking()
      } else {
        stopActivityTracking()
      }
    })

    return () => {
      subscription.unsubscribe()
      stopActivityTracking()
    }
  }, [fetchProfile, startActivityTracking, stopActivityTracking])

  // ── Login ─────────────────────────────────────────────────────
  const login = useCallback(async (employeeId, password) => {
    const empIdLower = employeeId.trim().toLowerCase()
    const email      = `${empIdLower}@stellaris.local`

    // 1. Check lockout via RPC (non-fatal if RPC unavailable)
    const { data: isLocked, error: lockError } = await supabase
      .rpc('check_login_lockout', { p_employee_id: empIdLower })

    if (lockError) console.warn('check_login_lockout RPC error:', lockError.message)
    if (!lockError && isLocked) {
      // Locked accounts have no JWT, so log_audit_event would no-op.
      // Insert directly via the public RLS policy (auth.uid() not required for
      // a locked-out attempt audit — handled by signInWithPassword's anon role,
      // so we simply skip; lockout is already captured in login_attempts).
      throw new Error('LOCKED')
    }

    // 2. Attempt sign-in
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    // 3. Log attempt (fire-and-forget)
    supabase.rpc('log_login_attempt', {
      p_employee_id: empIdLower,
      p_success:     !error,
      p_ip:          null,
    })

    if (error) {
      throw new Error(error.message)
    }

    // 4. Check active status
    const { data: profileData } = await supabase
      .from('users')
      .select('is_active, role')
      .eq('id', data.user.id)
      .single()

    if (profileData && !profileData.is_active) {
      await supabase.auth.signOut()
      throw new Error('Your account has been deactivated. Contact your administrator.')
    }

    // 5. Audit log
    await logAudit('LOGIN', { employee_id: empIdLower, role: profileData?.role })

    return profileData
  }, [])

  // ── Logout ────────────────────────────────────────────────────
  const logout = useCallback((reason = 'manual') => {
    stopActivityTracking()

    // Clear local state and navigate immediately — user sees logout at once.
    const hadProfile = !!profileRef.current
    setUser(null)
    setProfile(null)
    profileRef.current = null

    navigate(
      reason === 'timeout' ? '/login?reason=timeout'
      : reason === 'forced' ? '/login?reason=forced'
      : '/login',
    )

    // Mark this logout so the SIGNED_OUT event our background signOut() will
    // fire is recognized as locally-initiated. The onAuthStateChange listener
    // decrements the counter and skips clearing state — important if a new
    // login races ahead while the background signOut() is still in flight.
    pendingLogoutsRef.current += 1

    // Fire audit log + signOut in the background after state is cleared.
    // Audit RPC is sent while the JWT is still technically valid (signOut
    // hasn't been called yet), then signOut invalidates the session server-side.
    if (hadProfile) {
      logAudit('LOGOUT', { reason })
    }
    supabase.auth.signOut().catch(() => {})
  }, [navigate, stopActivityTracking])

  // ── Force-logout poll ─────────────────────────────────────────
  // A department head can end a user's active session from User
  // Management (Edge Function stamps users.force_logout_at). We poll
  // get_my_force_logout() and sign out when that timestamp is newer
  // than this session's access token. Runs in its OWN effect (never in
  // the onAuthStateChange listener) and only touches supabase.rpc — no
  // auth.* call — so it can't deadlock the auth lock.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    const check = async () => {
      const { data, error } = await supabase.rpc('get_my_force_logout')
      if (cancelled || error || !data) return
      const forcedSec = Math.floor(new Date(data).getTime() / 1000)
      const iat = sessionIatRef.current
      if (iat != null && forcedSec > iat) {
        logout('forced')
      }
    }

    check()
    const id = setInterval(check, FORCE_LOGOUT_POLL_MS)
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [user?.id, logout])

  // Department is derived from role: agent/supervisor/director are
  // Surveillance; pit_manager/casino_manager/shift_manager are Pit.
  // drillRole is the drill-taker role of the caller's department —
  // client-side queries that list "the team" filter on it.
  const department = ['pit_manager', 'casino_manager', 'shift_manager'].includes(profile?.role)
    ? 'pit'
    : 'surveillance'

  const value = {
    user,
    profile,
    loading,
    login,
    logout,
    isAgent:      profile?.role === 'agent' || profile?.role === 'pit_manager',
    isManagement: ['supervisor', 'director', 'casino_manager', 'shift_manager'].includes(profile?.role),
    // Only the two department heads may create/delete user accounts.
    canManageUsers: profile?.role === 'director' || profile?.role === 'casino_manager',
    department,
    drillRole:    department === 'pit' ? 'pit_manager' : 'agent',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
