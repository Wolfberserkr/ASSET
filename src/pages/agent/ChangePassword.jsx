import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { KeyRound, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function ChangePassword() {
  const [current,   setCurrent]   = useState('')
  const [newPass,   setNewPass]   = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showCurr,  setShowCurr]  = useState(false)
  const [showNew,   setShowNew]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [error,     setError]     = useState('')

  const requirements = [
    { label: 'At least 8 characters',     met: newPass.length >= 8 },
    { label: 'At least one number',        met: /\d/.test(newPass) },
    { label: 'Passwords match',            met: newPass === confirm && newPass.length > 0 },
  ]

  const allMet = requirements.every(r => r.met)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!allMet) return
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Re-authenticate with current password first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('Unable to verify current session.')

      // Sign in with current password to verify it
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      })
      if (verifyError) throw new Error('Current password is incorrect.')

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPass })
      if (updateError) throw updateError

      // Audit log
      supabase.rpc('log_audit_event', {
        p_action: 'PASSWORD_CHANGE',
        p_details: {},
      })

      setSuccess(true)
      setCurrent(''); setNewPass(''); setConfirm('')
    } catch (err) {
      setError(err.message || 'Password change failed.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'var(--color-brand-surface)',
    border: '1px solid var(--color-brand-border)',
    color: 'var(--color-brand-text)',
  }

  const PasswordField = ({ id, label, value, onChange, show, onToggle }) => (
    <div>
      <label htmlFor={id} className="block text-xs font-medium mb-1.5 uppercase tracking-widest"
        style={{ color: 'var(--color-brand-muted)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none"
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = 'var(--color-brand-gold)'}
          onBlur={e  => e.target.style.borderColor = 'var(--color-brand-border)'}
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--color-brand-muted)' }} tabIndex={-1}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )

  return (
    <Layout>
      <div className="max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <KeyRound size={18} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Change Password</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Update your account password</p>
          </div>
        </div>

        <div className="rounded-2xl p-6"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>

          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm"
              style={{ background: '#0f2f0f', border: '1px solid var(--color-brand-success)', color: 'var(--color-brand-success)' }}>
              <CheckCircle size={16} />
              Password changed successfully.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm"
              style={{ background: '#1f0a0a', border: '1px solid var(--color-brand-danger)', color: '#fca5a5' }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              id="current" label="Current Password"
              value={current} onChange={setCurrent}
              show={showCurr} onToggle={() => setShowCurr(v => !v)}
            />
            <PasswordField
              id="new" label="New Password"
              value={newPass} onChange={setNewPass}
              show={showNew} onToggle={() => setShowNew(v => !v)}
            />
            <PasswordField
              id="confirm" label="Confirm New Password"
              value={confirm} onChange={setConfirm}
              show={showNew} onToggle={() => setShowNew(v => !v)}
            />

            {/* Requirements */}
            {newPass && (
              <ul className="space-y-1">
                {requirements.map(r => (
                  <li key={r.label} className="flex items-center gap-2 text-xs"
                    style={{ color: r.met ? 'var(--color-brand-success)' : 'var(--color-brand-muted)' }}>
                    <CheckCircle size={12} />
                    {r.label}
                  </li>
                ))}
              </ul>
            )}

            <button type="submit" disabled={!allMet || loading || !current}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50 mt-2"
              style={{ background: 'var(--color-brand-gold)', color: '#0b0f1a' }}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
