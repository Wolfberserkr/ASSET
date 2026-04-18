import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { FileText, TrendingUp } from 'lucide-react'

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
      .limit(50)
      .then(({ data }) => { setSessions(data ?? []); setLoading(false) })
  }, [user])

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
          <FileText size={18} style={{ color: 'var(--color-brand-gold)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Session History</h1>
          <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Your last 50 drill sessions</p>
        </div>
      </div>

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
            <p style={{ color: 'var(--color-brand-muted)' }}>No sessions yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                {['Date', 'Status', 'Score', 'Time', '% Correct'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest"
                    style={{ color: 'var(--color-brand-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => {
                const date = new Date(s.completed_at ?? s.started_at)
                const pct  = s.status === 'completed' ? Math.round((s.score / 150) * 100) : null
                const mins = Math.floor((s.total_time_seconds ?? 0) / 60)
                const secs = (s.total_time_seconds ?? 0) % 60
                return (
                  <tr key={s.id}
                    style={{
                      borderBottom: i < sessions.length - 1 ? '1px solid var(--color-brand-border)' : 'none',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}>
                    <td className="px-4 py-3" style={{ color: 'var(--color-brand-text)' }}>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span className="ml-2 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                        {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-md text-xs font-medium" style={{
                        background: s.status === 'completed' ? '#0f2f0f' : s.status === 'abandoned' ? '#1f0a0a' : '#1a1f0f',
                        color: s.status === 'completed' ? 'var(--color-brand-success)' : s.status === 'abandoned' ? '#fca5a5' : 'var(--color-brand-warning)',
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold"
                      style={{ color: s.status === 'completed' ? 'var(--color-brand-text)' : 'var(--color-brand-muted)' }}>
                      {s.status === 'completed' ? s.score : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                      {s.total_time_seconds ? `${mins}m ${String(secs).padStart(2,'0')}s` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {pct !== null ? (
                        <span style={{ color: pct >= 70 ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }}>
                          {pct}%
                        </span>
                      ) : '—'}
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
