import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import StatCard from '../../components/StatCard'
import * as XLSX from 'xlsx'
import { ArrowLeft, Download, Trophy, Clock, CheckSquare, AlertTriangle } from 'lucide-react'

export default function AgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agent,    setAgent]    = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('users').select('*').eq('id', id).single(),
      supabase
        .from('sessions')
        .select('id, score, status, completed_at, total_time_seconds, total_questions, started_at, ip_address, user_agent')
        .eq('user_id', id)
        .order('started_at', { ascending: false })
        .limit(50),
    ]).then(([agentRes, sessionsRes]) => {
      setAgent(agentRes.data)
      setSessions(sessionsRes.data ?? [])
      setLoading(false)
    })
  }, [id])

  const completedSessions = sessions.filter(s => s.status === 'completed')
  const avgScore = completedSessions.length
    ? (completedSessions.reduce((s, x) => s + x.score, 0) / completedSessions.length).toFixed(1)
    : '—'
  const thisMonth = completedSessions.filter(s => {
    const d = new Date(s.completed_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const exportExcel = () => {
    const rows = sessions.map(s => ({
      'Date': s.completed_at ? new Date(s.completed_at).toLocaleString() : new Date(s.started_at).toLocaleString(),
      'Status': s.status,
      'Score': s.status === 'completed' ? s.score : '',
      'Time (s)': s.total_time_seconds ?? '',
      'IP Address': s.ip_address ?? '',
      'Device': s.user_agent ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sessions')
    ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 40 }]
    XLSX.writeFile(wb, `agent_${agent?.employee_id}_sessions.xlsx`)
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-brand-gold)' }} />
        </div>
      </Layout>
    )
  }

  if (!agent) return <Layout><p style={{ color: 'var(--color-brand-muted)' }}>Agent not found.</p></Layout>

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/management')} className="p-2 rounded-lg transition-colors"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}
          aria-label="Back to team dashboard">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>{agent.name}</h1>
          <p className="text-sm font-mono" style={{ color: 'var(--color-brand-muted)' }}>{agent.employee_id}</p>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-gold)' }}>
          <Download size={15} /> Export Excel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Avg Score"      value={avgScore}    icon={Trophy}      accent="var(--color-brand-gold)" />
        <StatCard label="This Month"     value={thisMonth}   icon={CheckSquare} accent={thisMonth >= 20 ? 'var(--color-brand-success)' : 'var(--color-brand-warning)'} sub="/ 20 required" />
        <StatCard label="Total Sessions" value={completedSessions.length} icon={Clock} />
      </div>

      {/* Sessions table */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
        <div className="px-4 py-3 text-sm font-semibold"
          style={{ borderBottom: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
          Session History
        </div>
        {sessions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>No sessions yet.</p>
        ) : (
          <div className="table-responsive">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                {['Date', 'Status', 'Score', 'Duration', 'IP'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest"
                    style={{ color: 'var(--color-brand-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => {
                const date = new Date(s.completed_at ?? s.started_at)
                const mins = Math.floor((s.total_time_seconds ?? 0) / 60)
                const secs = (s.total_time_seconds ?? 0) % 60
                return (
                  <tr key={s.id} style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--color-brand-border)' : 'none' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--color-brand-text)' }}>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      <span className="ml-2 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                        {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-md text-xs font-medium" style={{
                        background: s.status === 'completed' ? '#0f2f0f' : '#1f0a0a',
                        color: s.status === 'completed' ? 'var(--color-brand-success)' : '#fca5a5',
                      }}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: 'var(--color-brand-text)' }}>
                      {s.status === 'completed' ? s.score : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                      {s.total_time_seconds ? `${mins}m ${String(secs).padStart(2,'0')}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                      {s.ip_address ?? '—'}
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
