import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

const AuthContext = createContext(null)

const SESSION_TIMEOUT_MS = 30 * 60 * 1000  // 30 minutes inactivity
const ACTIVITY_EVENTS     = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)   // Supabase auth user
  const [profile, setProfile] = useState(null)   // public.users row
  const [loading, setLoading] = useState(true)

  const navigate      = useNavigate()
  const timeoutRef    = useRef(null)
  const profileRef    = useRef(null)

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // TOKEN_REFRESHED only rotates the JWT — profile and role are unchanged.
      if (event === 'TOKEN_REFRESHED') return

      // Guard against a background signOut() firing AFTER a new sign-in.
      // Logout calls signOut() without awaiting it so navigation is instant;
      // if the user logs back in before signOut() resolves, the resulting
      // SIGNED_OUT event would clear the freshly-authenticated state and kick
      // the user back to the login page. Check for a live session first and
      // bail out if one exists — it means a new login already raced ahead.
      if (event === 'SIGNED_OUT') {
        const { data: { session: live } } = await supabase.auth.getSession()
        if (live) return
      }

      const authUser = session?.user ?? null
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

    navigate(reason === 'timeout' ? '/login?reason=timeout' : '/login')

    // Fire audit log + signOut in the background after state is cleared.
    // Audit RPC is sent while the JWT is still technically valid (signOut
    // hasn't been called yet), then signOut invalidates the session server-side.
    if (hadProfile) {
      logAudit('LOGOUT', { reason })
    }
    supabase.auth.signOut().catch(() => {})
  }, [navigate, stopActivityTracking])

  const value = {
    user,
    profile,
    loading,
    login,
    logout,
    isAgent:      profile?.role === 'agent',
    isManagement: profile?.role === 'supervisor' || profile?.role === 'director',
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
