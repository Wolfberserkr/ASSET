import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { exportXlsx } from '../../lib/exportXlsx'
import {
  FileClock, Download, AlertTriangle, ShieldAlert, Users, Activity,
} from 'lucide-react'

const PERIODS = [
  { label: '24 hours', days: 1 },
  { label: '7 days',   days: 7 },
  { label: '30 days',  days: 30 },
  { label: '90 days',  days: 90 },
]

// Friendly labels for the known audit actions.
const ACTION_LABELS = {
  LOGIN: 'Logins',
  LOGOUT: 'Logouts',
  PASSWORD_CHANGE: 'Password changes (self)',
  PRACTICE_STARTED: 'Practice started',
  SESSION_STARTED: 'Drills started',
  SESSION_COMPLETED: 'Drills completed',
  SESSION_ABANDONED: 'Drills abandoned',
  QUESTION_CREATED: 'Questions created',
  QUESTION_UPDATED: 'Questions updated',
  QUESTION_TOGGLED: 'Questions toggled',
  USER_CREATED: 'Users created',
  USER_DELETED: 'Users deleted',
  USER_DEACTIVATED: 'Users deactivated',
  USER_REACTIVATED: 'Users reactivated',
  USER_PASSWORD_RESET: 'Password resets (admin)',
  USER_FORCE_LOGOUT: 'Forced logouts',
  REMEDIATION_ASSIGNED: 'Remediation assigned',
  REMEDIATION_COMPLETED: 'Remediation completed',
  REMEDIATION_CANCELLED: 'Remediation cancelled',
}

// Security-relevant actions surfaced in the "Notable events" panel.
const NOTABLE = new Set([
  'SESSION_ABANDONED', 'USER_CREATED', 'USER_DELETED', 'USER_DEACTIVATED',
  'USER_REACTIVATED', 'USER_PASSWORD_RESET', 'USER_FORCE_LOGOUT',
  'REMEDIATION_ASSIGNED', 'REMEDIATION_COMPLETED', 'REMEDIATION_CANCELLED',
])

const labelFor = (a) => ACTION_LABELS[a] ?? a

export default function AuditDigest() {
  const [days,     setDays]     = useState(7)
  const [digest,   setDigest]   = useState(null)
  const [failed,   setFailed]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const [dRes, fRes] = await Promise.all([
      supabase.rpc('get_audit_digest', { p_since: since }),
      supabase.rpc('get_failed_login_summary', { p_since: since }),
    ])
    if (dRes.error) { setError(dRes.error.message); setLoading(false); return }
    setDigest(dRes.data ?? { by_action: [], by_user: [], total: 0 })
    if (fRes.error) console.error('failed logins:', fRes.error)
    setFailed(fRes.data ?? [])
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  const byAction = digest?.by_action ?? []
  const byUser   = digest?.by_user ?? []
  const notable  = byAction.filter(a => NOTABLE.has(a.action))
  const totalFailed = failed.reduce((s, f) => s + Number(f.failed ?? 0), 0)

  const exportExcel = () => {
    const periodLabel = PERIODS.find(p => p.days === days)?.label ?? `${days}d`
    exportXlsx({
      filename: `stellaris_audit_digest_${days}d`,
      sheets: [
        { name: 'By Action', rows: byAction.map(a => ({ 'Action': labelFor(a.action), 'Raw Action': a.action, 'Count': Number(a.count) })), cols: [{ wch: 26 }, { wch: 24 }, { wch: 8 }] },
        { name: 'By User', rows: byUser.map(u => ({ 'Name': u.name, 'Employee ID': u.employee_id, 'Events': Number(u.count) })), cols: [{ wch: 24 }, { wch: 14 }, { wch: 8 }] },
        { name: 'Failed Logins', rows: failed.map(f => ({ 'Name': f.name, 'Employee ID': f.employee_id, 'Failed Attempts': Number(f.failed), 'Last Attempt': f.last_attempt ? new Date(f.last_attempt).toLocaleString() : '' })), cols: [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 22 }] },
        { name: 'Summary', rows: [{ 'Period': periodLabel, 'Total Events': Number(digest?.total ?? 0), 'Total Failed Logins': totalFailed }] },
      ],
    })
  }

  const card = { background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={card}>
            <FileClock size={16} style={{ color: 'var(--color-brand-cyan)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Audit Digest</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Activity summary for your department</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
            {PERIODS.map(p => <option key={p.days} value={p.days}>Last {p.label}</option>)}
          </select>
          <button onClick={exportExcel} disabled={loading || !digest}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ ...card, color: 'var(--color-brand-cyan)', opacity: loading ? 0.5 : 1 }}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm"
          style={{ background: '#1f0a0a', border: '1px solid var(--color-brand-danger)', color: '#fca5a5' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-brand-cyan)' }} />
        </div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl p-4" style={card}>
              <div className="flex items-center gap-1.5 mb-1"><Activity size={13} style={{ color: 'var(--color-brand-cyan)' }} /><span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Total Events</span></div>
              <span className="text-2xl font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>{Number(digest?.total ?? 0)}</span>
            </div>
            <div className="rounded-xl p-4" style={card}>
              <div className="flex items-center gap-1.5 mb-1"><Users size={13} style={{ color: 'var(--color-brand-cyan)' }} /><span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Active Users</span></div>
              <span className="text-2xl font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>{byUser.length}</span>
            </div>
            <div className="rounded-xl p-4" style={card}>
              <div className="flex items-center gap-1.5 mb-1"><ShieldAlert size={13} style={{ color: totalFailed > 0 ? '#fca5a5' : 'var(--color-brand-muted)' }} /><span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Failed Logins</span></div>
              <span className="text-2xl font-bold font-mono" style={{ color: totalFailed > 0 ? '#fca5a5' : 'var(--color-brand-text)' }}>{totalFailed}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By action */}
            <div className="rounded-xl overflow-hidden" style={card}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>By activity</p>
              </div>
              {byAction.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>No activity in this period.</p>
              ) : (
                <div className="p-2">
                  {byAction.map(a => (
                    <div key={a.action} className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-sm" style={{ color: 'var(--color-brand-text)' }}>{labelFor(a.action)}</span>
                      <span className="text-sm font-mono font-semibold" style={{ color: 'var(--color-brand-cyan)' }}>{Number(a.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Most active users */}
            <div className="rounded-xl overflow-hidden" style={card}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>Most active</p>
              </div>
              {byUser.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>No user activity.</p>
              ) : (
                <div className="p-2">
                  {byUser.map(u => (
                    <div key={u.employee_id} className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-sm truncate" style={{ color: 'var(--color-brand-text)' }}>
                        {u.name} <span className="font-mono text-xs" style={{ color: 'var(--color-brand-muted)' }}>{u.employee_id}</span>
                      </span>
                      <span className="text-sm font-mono font-semibold" style={{ color: 'var(--color-brand-cyan)' }}>{Number(u.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notable events */}
            <div className="rounded-xl overflow-hidden" style={card}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                <ShieldAlert size={14} style={{ color: 'var(--color-brand-warning)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>Notable events</p>
              </div>
              {notable.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>No admin or abandon events.</p>
              ) : (
                <div className="p-2">
                  {notable.map(a => (
                    <div key={a.action} className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-sm" style={{ color: 'var(--color-brand-text)' }}>{labelFor(a.action)}</span>
                      <span className="text-sm font-mono font-semibold" style={{ color: 'var(--color-brand-warning)' }}>{Number(a.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Failed logins */}
            <div className="rounded-xl overflow-hidden" style={card}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                <ShieldAlert size={14} style={{ color: '#fca5a5' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>Failed logins by user</p>
              </div>
              {failed.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>No failed sign-ins.</p>
              ) : (
                <div className="p-2">
                  {failed.map(f => (
                    <div key={f.employee_id} className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-sm truncate" style={{ color: 'var(--color-brand-text)' }}>
                        {f.name} <span className="font-mono text-xs" style={{ color: 'var(--color-brand-muted)' }}>{f.employee_id}</span>
                      </span>
                      <span className="text-sm font-mono font-semibold" style={{ color: '#fca5a5' }}>{Number(f.failed)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
