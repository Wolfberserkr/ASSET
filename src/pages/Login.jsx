import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Shield, Eye, EyeOff, AlertCircle, Clock } from 'lucide-react'
import VantaBackground from '../components/VantaBackground'

export default function Login() {
  const { login, profile, isAgent, isManagement, loading } = useAuth()
  const navigate       = useNavigate()
  const [params]       = useSearchParams()

  const [employeeId, setEmployeeId] = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [error,      setError]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [attempts,   setAttempts]   = useState(0)  // local UI counter

  const timeoutReason = params.get('reason') === 'timeout'

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && profile) {
      if (isManagement) navigate('/management')
      else if (isAgent) navigate('/dashboard')
    }
  }, [loading, profile, isAgent, isManagement, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(employeeId, password)
      // Navigation is handled by the useEffect above once AuthContext
      // finishes fetching the profile via onAuthStateChange. Keep
      // submitting=true so the form does not flicker back to its idle
      // state during the redirect.
    } catch (err) {
      const msg = err.message

      if (msg === 'LOCKED') {
        setError('Account locked — too many failed attempts. Try again in 15 minutes.')
      } else if (msg.includes('Invalid login credentials')) {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        const remaining = 5 - newAttempts
        if (remaining <= 0) {
          setError('Account locked — too many failed attempts. Try again in 15 minutes.')
        } else {
          setError(`Invalid ID or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`)
        }
      } else {
        setError(msg || 'Login failed. Please try again.')
      }
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen w-screen"
        style={{ background: 'var(--color-brand-bg)' }}
      >
        {/* Outer pulse ring */}
        <div className="relative flex items-center justify-center">
          <span
            className="absolute inline-flex rounded-full opacity-30 animate-ping"
            style={{
              width: 88,
              height: 88,
              background: 'var(--color-brand-gold)',
              animationDuration: '1.4s',
            }}
          />
          {/* Inner card */}
          <div
            className="relative inline-flex items-center justify-center rounded-2xl"
            style={{
              width: 72,
              height: 72,
              background: 'var(--color-brand-card)',
              border: '1px solid var(--color-brand-border)',
              boxShadow: '0 0 32px 4px rgba(212,175,55,0.15)',
            }}
          >
            <Shield size={36} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
        </div>

        {/* Label */}
        <p
          className="mt-5 text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.18em' }}
        >
          A.S.S.E.T.
        </p>
      </div>
    )
  }

  return (
    <div
      className="page-enter min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--color-brand-bg)' }}
    >
      {/* ── Vanta NET background ── */}
      <VantaBackground className="absolute inset-0" />

      {/* ── Login card (sits above canvas) ── */}
      <div className="w-full max-w-sm relative z-10">

        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
          >
            <Shield size={32} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-brand-text)' }}>
            A.S.S.E.T.
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-brand-muted)' }}>
            Aruba Surveillance Skill Enhancement &amp; Training
          </p>
        </div>

        {/* Timeout notice */}
        {timeoutReason && !error && (
          <div
            className="alert-enter flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
            style={{ background: '#1c1a0f', border: '1px solid var(--color-brand-warning)', color: 'var(--color-brand-warning)' }}
          >
            <Clock size={16} className="shrink-0" />
            <span>You were signed out due to inactivity.</span>
          </div>
        )}

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
        >
          <h2 className="text-lg font-semibold mb-5" style={{ color: 'var(--color-brand-text)' }}>
            Sign in
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Employee ID */}
            <div>
              <label
                htmlFor="employeeId"
                className="block text-xs font-medium mb-1.5 uppercase tracking-widest"
                style={{ color: 'var(--color-brand-muted)' }}
              >
                Employee ID
              </label>
              <input
                id="employeeId"
                type="text"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                placeholder="B-001"
                required
                autoComplete="username"
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg text-sm font-mono outline-none transition-colors"
                style={{
                  background: 'var(--color-brand-surface)',
                  border: '1px solid var(--color-brand-border)',
                  color: 'var(--color-brand-text)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-brand-gold)'}
                onBlur={e  => e.target.style.borderColor = 'var(--color-brand-border)'}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium mb-1.5 uppercase tracking-widest"
                style={{ color: 'var(--color-brand-muted)' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    background: 'var(--color-brand-surface)',
                    border: '1px solid var(--color-brand-border)',
                    color: 'var(--color-brand-text)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--color-brand-gold)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--color-brand-border)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-brand-muted)' }}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="alert-enter flex items-start gap-2 p-3 rounded-lg text-sm"
                style={{ background: '#1f0a0a', border: '1px solid var(--color-brand-danger)', color: '#fca5a5' }}
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !employeeId || !password}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50 active:scale-[0.98] transition-transform duration-100"
              style={{
                background: 'var(--color-brand-gold)',
                color: '#0b0f1a',
              }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--color-brand-muted)' }}>
          Forgot your password? Contact your supervisor.
        </p>
      </div>
    </div>
  )
}
