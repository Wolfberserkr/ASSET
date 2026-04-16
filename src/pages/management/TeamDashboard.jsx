import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import VantaBackground from '../../components/VantaBackground'
import StatCard from '../../components/StatCard'
import * as XLSX from 'xlsx'
import {
  Users, Trophy, CheckSquare, Download,
  ChevronRight, AlertTriangle, Search,
} from 'lucide-react'

// ── Export helpers ─────────────────────────────────────────────
function exportToExcel(agents, dateRange) {
  const rows = agents.map(a => ({
    'Employee ID':        a.employee_id,
    'Name':               a.name,
    'Role':               a.role,
    'Active':             a.is_active ? 'Yes' : 'No',
    'Sessions (Month)':   Number(a.sessions_this_month ?? 0),
    'Avg Score':          a.avg_score != null ? Number(a.avg_score) : '',
    'Last Session':       a.last_session_at
      ? new Date(a.last_session_at).toLocaleString()
      : 'Never',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Team Dashboard')

  // Column widths
  ws['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 8 },
    { wch: 18 }, { wch: 12 }, { wch: 22 },
  ]

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `stellaris_team_dashboard_${today}.xlsx`)
}

export default function TeamDashboard() {
  const navigate = useNavigate()
  const [agents,    setAgents]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [search,    setSearch]    = useState('')

  const loadAgents = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('get_all_agents')
    if (err) { setError(err.message); setLoading(false); return }
    setAgents(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAgents() }, [loadAgents])

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.employee_id.toLowerCase().includes(search.toLowerCase())
  )

  // Summary stats
  const totalAgents   = agents.length
  const avgScore      = agents.length
    ? (agents.reduce((s, a) => s + (a.avg_score ?? 0), 0) / agents.length).toFixed(1)
    : '—'
  const onTrack       = agents.filter(a => Number(a.sessions_this_month ?? 0) >= 20).length
  const belowTarget   = agents.filter(a => Number(a.sessions_this_month ?? 0) < 20)

  return (
    <Layout bg={<VantaBackground style={{ width: '100%', height: '100%' }} />}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Team Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-brand-muted)' }}>
            {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })} performance
          </p>
        </div>
        <button
          onClick={() => exportToExcel(filtered)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity self-start"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-gold)' }}
          aria-label="Export team dashboard to Excel"
        >
          <Download size={16} />
          Export Excel
        </button>
      </div>

      {/* Recert warning */}
      {belowTarget.length > 0 && (
        <div
          className="flex items-start gap-2 p-3 rounded-lg mb-5 text-sm"
          style={{ background: '#1c1a0f', border: '1px solid var(--color-brand-warning)', color: 'var(--color-brand-warning)' }}
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            <strong>{belowTarget.length} agent{belowTarget.length > 1 ? 's are' : ' is'}</strong> below the 20-session monthly target:{' '}
            {belowTarget.map(a => a.name.split(' ')[0]).join(', ')}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm"
          style={{ background: '#1f0a0a', border: '1px solid var(--color-brand-danger)', color: '#fca5a5' }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total Agents"   value={totalAgents} icon={Users}       accent="var(--color-brand-blue)" />
        <StatCard label="Team Avg Score" value={avgScore}    icon={Trophy}      accent="var(--color-brand-gold)" />
        <StatCard label="On Track"       value={`${onTrack}/${totalAgents}`} icon={CheckSquare} accent="var(--color-brand-success)" sub="20 sessions this month" />
      </div>

      {/* Agent table */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>

        {/* Search bar */}
        <div className="px-4 py-3 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
          <Search size={16} style={{ color: 'var(--color-brand-muted)' }} />
          <input
            type="text"
            placeholder="Search agents…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-brand-text)' }}
          />
          <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
            {filtered.length} of {agents.length}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-brand-gold)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <p style={{ color: 'var(--color-brand-muted)' }}>No agents found.</p>
          </div>
        ) : (
          <div className="table-responsive">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                {['Agent', 'Status', 'Sessions', 'Avg Score', 'Last Active', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest"
                    style={{ color: 'var(--color-brand-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((agent, i) => {
                const sessionsCount = Number(agent.sessions_this_month ?? 0)
                const onTrackAgent  = sessionsCount >= 20
                const lastActive    = agent.last_session_at
                  ? new Date(agent.last_session_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'Never'

                return (
                  <tr key={agent.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--color-brand-border)' : 'none',
                    }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: 'var(--color-brand-gold)', color: '#0b0f1a' }}>
                          {agent.name[0]}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--color-brand-text)' }}>{agent.name}</p>
                          <p className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>{agent.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-md text-xs font-medium"
                        style={{
                          background: agent.is_active ? '#0f2f0f' : '#1f0a0a',
                          color: agent.is_active ? 'var(--color-brand-success)' : '#fca5a5',
                        }}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold"
                          style={{ color: onTrackAgent ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }}>
                          {sessionsCount}
                        </span>
                        <span style={{ color: 'var(--color-brand-muted)' }}>/ 20</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono"
                      style={{ color: agent.avg_score != null ? 'var(--color-brand-text)' : 'var(--color-brand-muted)' }}>
                      {agent.avg_score != null ? agent.avg_score : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                      {lastActive}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/management/agent/${agent.id}`)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
                        style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)', border: '1px solid var(--color-brand-border)' }}
                      >
                        Detail <ChevronRight size={14} />
                      </button>
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
