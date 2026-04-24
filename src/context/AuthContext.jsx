import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      fetchProfile(authUser).finally(() => setLoading(false))
      if (authUser) startActivityTracking()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      setLoading(true)
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
    if (!lockError && isLocked) throw new Error('LOCKED')

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
    supabase.rpc('log_audit_event', {
      p_action:  'LOGIN',
      p_details: { employee_id: empIdLower },
    })

    return profileData
  }, [])

  // ── Logout ────────────────────────────────────────────────────
  const logout = useCallback(async (reason = 'manual') => {
    if (profileRef.current) {
      supabase.rpc('log_audit_event', {
        p_action:  'LOGOUT',
        p_details: { reason },
      })
    }

    stopActivityTracking()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    profileRef.current = null

    if (reason === 'timeout') {
      navigate('/login?reason=timeout')
    } else {
      navigate('/login')
    }
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
