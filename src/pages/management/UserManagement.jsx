import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import {
  UserCog, UserPlus, X, AlertTriangle, Eye, EyeOff,
  ShieldCheck, ShieldOff, Trash2, Info, Check,
} from 'lucide-react'

const ROLE_LABELS = {
  agent: 'Agent',
  supervisor: 'Supervisor',
  director: 'Director',
  pit_manager: 'Pit Manager',
  shift_manager: 'Shift Manager',
  casino_manager: 'Casino Manager',
}

// Roles each department head may assign, in dropdown order.
const ASSIGNABLE_ROLES = {
  surveillance: ['agent', 'supervisor'],
  pit: ['pit_manager', 'shift_manager'],
}

const ACCOUNT_HEADS = ['director', 'casino_manager']

// Extracts the friendly message the Edge Function put in its JSON body.
async function invokeAdmin(payload) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload })
  if (error) {
    let message = error.message
    let code = null
    try {
      const body = await error.context.json()
      code = body.error ?? null
      message = body.message ?? body.error ?? message
    } catch { /* non-JSON error body — keep the default message */ }
    return { ok: false, error: message, code }
  }
  return { ok: true, data }
}

export default function UserManagement() {
  const { user, department } = useAuth()
  const assignable = ASSIGNABLE_ROLES[department] ?? []

  const [users,   setUsers]   = useState([])
  const [history, setHistory] = useState(() => new Set()) // ids with ≥1 session
  const [loading, setLoading] = useState(true)
  const [busyId,  setBusyId]  = useState(null)            // row action in-flight
  const [banner,  setBanner]  = useState(null)            // { type, text }

  // Create modal
  const [form,       setForm]       = useState(null)      // null = closed
  const [showPw,     setShowPw]     = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')

  // Delete confirm
  const [confirmDel, setConfirmDel] = useState(null)      // user row pending hard delete

  const loadUsers = async () => {
    const [{ data: rows }, { data: sessions }] = await Promise.all([
      supabase.from('users').select('id, employee_id, name, role, is_active').order('name'),
      supabase.from('sessions').select('user_id'),
    ])
    setUsers(rows ?? [])
    setHistory(new Set((sessions ?? []).map(s => s.user_id)))
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const flash = (type, text) => {
    setBanner({ type, text })
    if (type === 'success') setTimeout(() => setBanner(null), 4000)
  }

  const openCreate = () => {
    setForm({ employee_id: '', name: '', password: '', role: assignable[0] ?? '' })
    setFormError('')
    setShowPw(false)
  }

  const submitCreate = async () => {
    const employee_id = form.employee_id.trim()
    const name = form.name.trim()
    if (!employee_id || !name || !form.password || !form.role) {
      setFormError('Employee ID, name, password and role are all required.')
      return
    }
    if (!/^[A-Za-z0-9._-]+$/.test(employee_id)) {
      setFormError('Employee ID may only contain letters, numbers, dot, dash and underscore.')
      return
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    setSaving(true); setFormError('')
    const res = await invokeAdmin({
      action: 'create',
      employee_id, name, password: form.password, role: form.role,
    })
    setSaving(false)
    if (!res.ok) { setFormError(res.error); return }

    // The edge function writes the USER_CREATED audit row (service role).
    setForm(null)
    flash('success', `Created ${name} (${employee_id}) as ${ROLE_LABELS[form.role]}.`)
    loadUsers()
  }

  const setActive = async (u, active) => {
    setBusyId(u.id)
    const { error } = await supabase.rpc('set_user_active', { p_user_id: u.id, p_active: active })
    setBusyId(null)
    if (error) { flash('error', error.message); return }
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: active } : x))
    flash('success', `${u.name} ${active ? 'reactivated' : 'deactivated'}.`)
  }

  const hardDelete = async (u) => {
    setConfirmDel(null)
    setBusyId(u.id)
    const res = await invokeAdmin({ action: 'delete', user_id: u.id })
    setBusyId(null)
    if (!res.ok) {
      flash('error', res.code === 'HAS_HISTORY'
        ? `${u.name} has session history and can't be permanently deleted — deactivate instead.`
        : res.error)
      loadUsers()
      return
    }
    // The edge function writes the USER_DELETED audit row (service role).
    setUsers(prev => prev.filter(x => x.id !== u.id))
    flash('success', `Permanently deleted ${u.name} (${u.employee_id}).`)
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none'
  const inputStyle = {
    background: 'var(--color-brand-surface)',
    border: '1px solid var(--color-brand-border)',
    color: 'var(--color-brand-text)',
  }

  const deptLabel = department === 'pit' ? 'Pit' : 'Surveillance'

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <UserCog size={16} style={{ color: 'var(--color-brand-cyan)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>User Management</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
              Create and manage {deptLabel} accounts
            </p>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold self-start"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }}>
          <UserPlus size={16} /> New User
        </button>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 p-3 rounded-lg mb-4 text-sm"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}>
        <Info size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--color-brand-cyan)' }} />
        <span>
          New users sign in with their <strong style={{ color: 'var(--color-brand-text)' }}>Employee ID</strong> and the
          password you set here — hand the credentials over directly. Deactivating blocks login but keeps all history;
          permanent deletion is only available for accounts that have never run a session.
        </span>
      </div>

      {/* Action banner */}
      {banner && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
          style={{
            background: banner.type === 'error' ? '#2a0a0a' : '#0f1f14',
            border: `1px solid ${banner.type === 'error' ? 'var(--color-brand-danger, #fca5a5)' : 'var(--color-brand-success)'}`,
            color: banner.type === 'error' ? '#fca5a5' : 'var(--color-brand-success)',
          }}>
          {banner.type === 'error' ? <AlertTriangle size={15} /> : <Check size={15} />}
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="ml-auto p-1 rounded hover:opacity-60" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* User list */}
      <div className="rounded-xl overflow-hidden mb-6"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-brand-cyan)' }} />
          </div>
        ) : users.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>
            No users in your department yet.
          </p>
        ) : (
          users.map((u, i) => {
            const isSelf = u.id === user?.id
            const isHead = ACCOUNT_HEADS.includes(u.role)
            const locked = isSelf || isHead            // cannot deactivate/delete
            const canHardDelete = !locked && !history.has(u.id)
            const busy = busyId === u.id
            return (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < users.length - 1 ? '1px solid var(--color-brand-border)' : 'none',
                  opacity: u.is_active ? 1 : 0.55 }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }}>
                  {(u.name?.[0] ?? u.employee_id?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-brand-text)' }}>
                    {u.name} {isSelf && <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>(you)</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md"
                      style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)' }}>
                      {u.employee_id}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md"
                      style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-cyan)' }}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    <span className="text-xs font-medium"
                      style={{ color: u.is_active ? 'var(--color-brand-success)' : '#fca5a5' }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {busy ? (
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin shrink-0"
                    style={{ borderColor: 'var(--color-brand-cyan)' }} />
                ) : locked ? (
                  <span className="text-xs shrink-0" style={{ color: 'var(--color-brand-muted)' }}>—</span>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    {u.is_active ? (
                      <button onClick={() => setActive(u, false)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-warning)' }}
                        title="Deactivate — blocks login, keeps history">
                        <ShieldOff size={14} /> Deactivate
                      </button>
                    ) : (
                      <button onClick={() => setActive(u, true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-success)' }}
                        title="Reactivate — restores login">
                        <ShieldCheck size={14} /> Reactivate
                      </button>
                    )}
                    <button onClick={() => setConfirmDel(u)} disabled={!canHardDelete}
                      className="p-2 rounded-lg min-w-[34px] min-h-[34px] flex items-center justify-center"
                      style={{
                        background: 'var(--color-brand-surface)',
                        color: canHardDelete ? '#fca5a5' : 'var(--color-brand-muted)',
                        opacity: canHardDelete ? 1 : 0.4,
                        cursor: canHardDelete ? 'pointer' : 'not-allowed',
                      }}
                      title={canHardDelete
                        ? 'Delete permanently'
                        : 'Has session history — deactivate instead'}
                      aria-label="Delete permanently">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Create modal */}
      {form && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          role="dialog" aria-modal="true" aria-label="Create user">
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--color-brand-text)' }}>New {deptLabel} User</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-brand-muted)' }}>
                  Sets up the login account and password
                </p>
              </div>
              <button onClick={() => setForm(null)} style={{ color: 'var(--color-brand-muted)' }} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>Employee ID</label>
                <input type="text" value={form.employee_id} autoFocus autoCapitalize="none" autoCorrect="off"
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  placeholder="e.g. jdoe" className={inputCls} style={inputStyle} />
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-brand-muted)' }}>
                  Used to log in. Email becomes{' '}
                  <span className="font-mono">{(form.employee_id.trim().toLowerCase() || 'id')}@stellaris.local</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>Full Name</label>
                <input type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Jane Doe" className={inputCls} style={inputStyle} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password} autoComplete="new-password"
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="At least 8 characters" className={inputCls} style={{ ...inputStyle, paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                    style={{ color: 'var(--color-brand-muted)' }} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>Role</label>
                <select value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className={inputCls} style={inputStyle}>
                  {assignable.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
                  style={{ background: '#2a0a0a', border: '1px solid #fca5a5', color: '#fca5a5' }}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setForm(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}>
                Cancel
              </button>
              <button onClick={submitCreate} disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating…</>
                ) : (
                  <><UserPlus size={15} /> Create User</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Delete confirmation */}
      {confirmDel && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#2a0a0a', color: '#fca5a5' }}>
                <Trash2 size={18} />
              </div>
              <h2 className="font-bold text-lg" style={{ color: 'var(--color-brand-text)' }}>Delete permanently?</h2>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--color-brand-muted)' }}>
              This permanently removes <strong style={{ color: 'var(--color-brand-text)' }}>{confirmDel.name}</strong>{' '}
              (<span className="font-mono">{confirmDel.employee_id}</span>) and their login. This cannot be undone.
              To keep a record instead, deactivate the account.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}>
                Cancel
              </button>
              <button onClick={() => hardDelete(confirmDel)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: '#dc2626', color: '#fff' }}>
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Layout>
  )
}
