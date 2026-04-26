import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { FileText, TrendingUp, Trophy, Target, CalendarCheck } from 'lucide-react'

const REQUIRED = 20

export default function History() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('sessions')
      .select('id, score, status, completed_at, total_time_seconds, total_questions, started_at')
      .eq('user_id', user.id)
      .in('status', ['completed', 'abandoned'])
      .order('started_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setSessions(data ?? []); setLoading(false) })
  }, [user])

  const completed = useMemo(() => sessions.filter(s => s.status === 'completed'), [sessions])

  const thisMonth = useMemo(() => {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return completed.filter(s => new Date(s.completed_at) >= firstOfMonth)
  }, [completed])

  const bestScore = completed.length ? Math.max(...completed.map(s => s.score ?? 0)) : null
  const avgScore  = completed.length
    ? Math.round(completed.reduce((s, c) => s + (c.score ?? 0), 0) / completed.length)
    : null

  const scoreColor = (score) => {
    if (score == null) return 'var(--color-brand-muted)'
    const pct = (score / 150) * 100
    if (pct >= 80) return 'var(--color-brand-success)'
    if (pct >= 60) return 'var(--color-brand-warning)'
    return 'var(--color-brand-danger)'
  }

  const monthProgress = thisMonth.length
  const progressPct   = Math.min(100, Math.round((monthProgress / REQUIRED) * 100))
  const progressColor = progressPct >= 100
    ? 'var(--color-brand-success)'
    : progressPct >= 60
      ? 'var(--color-brand-warning)'
      : 'var(--color-brand-danger)'

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
          <FileText size={18} style={{ color: 'var(--color-brand-gold)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Session History</h1>
          <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Your last 100 drill sessions</p>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {/* This month */}
          <div className="rounded-xl p-4"
            style={{ background: 'var(--color-brand-card)', border: `1px solid ${progressPct >= 100 ? 'var(--color-brand-success)' : 'var(--color-brand-border)'}` }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>This Month</p>
              <CalendarCheck size={14} style={{ color: progressColor }} />
            </div>
            <p className="text-2xl font-bold font-mono mb-2" style={{ color: progressColor }}>
              {monthProgress} <span className="text-base font-normal" style={{ color: 'var(--color-brand-muted)' }}>/ {REQUIRED}</span>
            </p>
            <div className="h-1.5 rounded-full" style={{ background: 'var(--color-brand-border)' }}>
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%`, background: progressColor }} />
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-brand-muted)' }}>
              {progressPct >= 100 ? 'Recertification complete' : `${REQUIRED - monthProgress} more to recertify`}
            </p>
          </div>

          {/* Best score */}
          <div className="rounded-xl p-4"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Best Score</p>
              <Trophy size={14} style={{ color: 'var(--color-brand-gold)' }} />
            </div>
            <p className="text-2xl font-bold font-mono" style={{ color: bestScore != null ? scoreColor(bestScore) : 'var(--color-brand-muted)' }}>
              {bestScore ?? '—'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-brand-muted)' }}>Max possible: 150</p>
          </div>

          {/* Avg score */}
          <div className="rounded-xl p-4"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Avg Score</p>
              <Target size={14} style={{ color: 'var(--color-brand-blue)' }} />
            </div>
            <p className="text-2xl font-bold font-mono" style={{ color: avgScore != null ? scoreColor(avgScore) : 'var(--color-brand-muted)' }}>
              {avgScore ?? '—'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-brand-muted)' }}>
              {completed.length} completed session{completed.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Sessions table */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-brand-gold)' }} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center">
            <TrendingUp size={36} className="mx-auto mb-3" style={{ color: 'var(--color-brand-border)' }} />
            <p style={{ color: 'var(--color-brand-muted)' }}>No sessions yet — complete your first drill to see history.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                  {['Date', 'Status', 'Score', 'Score %', 'Time'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest"
                      style={{ color: 'var(--color-brand-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => {
                  const date   = new Date(s.completed_at ?? s.started_at)
                  const scorePct = s.status === 'completed' && s.score != null
                    ? Math.round((s.score / 150) * 100)
                    : null
                  const mins = Math.floor((s.total_time_seconds ?? 0) / 60)
                  const secs = (s.total_time_seconds ?? 0) % 60
                  return (
                    <tr key={s.id}
                      style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--color-brand-border)' : 'none' }}>
                      <td className="px-4 py-3">
                        <p style={{ color: 'var(--color-brand-text)' }}>
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                          {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-md text-xs font-medium" style={{
                          background: s.status === 'completed' ? '#0f2f0f' : '#1f0a0a',
                          color:      s.status === 'completed' ? 'var(--color-brand-success)' : '#fca5a5',
                        }}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold"
                        style={{ color: s.status === 'completed' ? scoreColor(s.score) : 'var(--color-brand-muted)' }}>
                        {s.status === 'completed' ? s.score : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {scorePct !== null ? (
                          <div>
                            <span className="font-mono text-xs" style={{ color: scoreColor(s.score) }}>{scorePct}%</span>
                            <div className="w-16 h-1 rounded-full mt-1" style={{ background: 'var(--color-brand-border)' }}>
                              <div className="h-1 rounded-full" style={{ width: `${scorePct}%`, background: scoreColor(s.score) }} />
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--color-brand-muted)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                        {s.total_time_seconds ? `${mins}m ${String(secs).padStart(2, '0')}s` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
