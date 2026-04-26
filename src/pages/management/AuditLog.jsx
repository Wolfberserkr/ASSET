import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import * as XLSX from 'xlsx'
import { FileText, Download, Search, RefreshCw } from 'lucide-react'

const DATE_RANGES = [
  { label: 'Last 24 hours', value: '1'   },
  { label: 'Last 7 days',   value: '7'   },
  { label: 'Last 30 days',  value: '30'  },
  { label: 'Last 90 days',  value: '90'  },
  { label: 'All time',      value: 'all' },
]

const ACTION_CATEGORIES = [
  { label: 'All actions',   value: 'all'     },
  { label: 'Auth events',   value: 'auth'    },
  { label: 'Sessions',      value: 'session' },
]

const AUTH_ACTIONS    = new Set(['LOGIN', 'LOGOUT', 'PASSWORD_CHANGE'])
const SESSION_ACTIONS = new Set(['SESSION_COMPLETED', 'SESSION_ABANDONED'])

function actionCategory(action) {
  if (AUTH_ACTIONS.has(action))    return 'auth'
  if (SESSION_ACTIONS.has(action)) return 'session'
  return 'other'
}

function actionColor(action) {
  if (action === 'LOGIN')              return 'var(--color-brand-blue)'
  if (action === 'LOGOUT')             return 'var(--color-brand-muted)'
  if (action === 'PASSWORD_CHANGE')    return 'var(--color-brand-warning)'
  if (action === 'SESSION_COMPLETED')  return 'var(--color-brand-success)'
  if (action === 'SESSION_ABANDONED')  return 'var(--color-brand-danger)'
  return 'var(--color-brand-text)'
}

function formatDetails(details) {
  if (!details) return null
  if (details.reason)     return details.reason
  if (details.score !== undefined) {
    const parts = [`${details.score} pts`]
    if (details.correct !== undefined) parts.push(`${details.correct}/10 correct`)
    return parts.join(' · ')
  }
  return null
}

function formatTs(iso) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return { date, time }
}

export default function AuditLog() {
  const [logs,    setLogs]    = useState([])
  const [agents,  setAgents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  // Filters
  const [dateRange,     setDateRange]     = useState('30')
  const [selectedAgent, setSelectedAgent] = useState('all')
  const [actionCat,     setActionCat]     = useState('all')

  const load = useCallback(async () => {
    setLoading(true)

    const dateFrom = dateRange === 'all'
      ? null
      : new Date(Date.now() - Number(dateRange) * 86400000).toISOString()

    const [logsRes, agentsRes] = await Promise.all([
      (() => {
        let q = supabase
          .from('audit_log')
          .select('id, action, details, ip_address, created_at, user_id, users(name, employee_id)')
          .order('created_at', { ascending: false })
          .limit(500)
        if (dateFrom) q = q.gte('created_at', dateFrom)
        return q
      })(),
      supabase
        .from('users')
        .select('id, name, employee_id')
        .eq('role', 'agent')
        .eq('is_active', true)
        .order('name'),
    ])

    setLogs(logsRes.data ?? [])
    setAgents(agentsRes.data ?? [])
    setLoading(false)
  }, [dateRange])

  useEffect(() => { load() }, [load])

  const displayed = useMemo(() => {
    return logs.filter(l => {
      if (selectedAgent !== 'all' && l.user_id !== selectedAgent) return false
      if (actionCat     !== 'all' && actionCategory(l.action) !== actionCat) return false
      if (search) {
        const s = search.toLowerCase()
        const matchAction = l.action.toLowerCase().includes(s)
        const matchName   = l.users?.name?.toLowerCase().includes(s) ?? false
        const matchEmpId  = l.users?.employee_id?.toLowerCase().includes(s) ?? false
        if (!matchAction && !matchName && !matchEmpId) return false
      }
      return true
    })
  }, [logs, selectedAgent, actionCat, search])

  // Summary counts
  const counts = useMemo(() => ({
    logins:     displayed.filter(l => l.action === 'LOGIN').length,
    sessions:   displayed.filter(l => l.action === 'SESSION_COMPLETED').length,
    abandoned:  displayed.filter(l => l.action === 'SESSION_ABANDONED').length,
    pwChanges:  displayed.filter(l => l.action === 'PASSWORD_CHANGE').length,
  }), [displayed])

  const exportExcel = () => {
    const rows = displayed.map(l => ({
      'Timestamp':   new Date(l.created_at).toLocaleString(),
      'Agent':       l.users?.name ?? '—',
      'Employee ID': l.users?.employee_id ?? '—',
      'Action':      l.action,
      'Details':     l.details ? JSON.stringify(l.details) : '',
      'IP Address':  l.ip_address ?? '—',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log')
    ws['!cols'] = [
      { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 40 }, { wch: 16 },
    ]
    XLSX.writeFile(wb, `audit_log_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <FileText size={16} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Audit Log</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Append-only activity record</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-gold)' }}>
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Logins',       value: counts.logins,    color: 'var(--color-brand-blue)'    },
          { label: 'Sessions',     value: counts.sessions,  color: 'var(--color-brand-success)' },
          { label: 'Abandoned',    value: counts.abandoned, color: counts.abandoned ? 'var(--color-brand-danger)' : 'var(--color-brand-muted)' },
          { label: 'PW Changes',   value: counts.pwChanges, color: counts.pwChanges ? 'var(--color-brand-warning)' : 'var(--color-brand-muted)' },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-4"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <p className="text-xs font-medium uppercase tracking-widest mb-1"
              style={{ color: 'var(--color-brand-muted)' }}>{c.label}</p>
            <p className="text-2xl font-bold font-mono" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
          <Search size={15} style={{ color: 'var(--color-brand-muted)', flexShrink: 0 }} />
          <input type="text" placeholder="Search actions or agents…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-32 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-brand-text)' }} />

          <select value={dateRange} onChange={e => setDateRange(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
            {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>

          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
            <option value="all">All agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <select value={actionCat} onChange={e => setActionCat(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
            {ACTION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          <span className="text-xs ml-auto" style={{ color: 'var(--color-brand-muted)' }}>
            {displayed.length} event{displayed.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-brand-gold)' }} />
          </div>
        ) : displayed.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>
            No events match the current filters.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                  {['Timestamp', 'Agent', 'Action', 'Details', 'IP'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest"
                      style={{ color: 'var(--color-brand-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((log, i) => {
                  const { date, time } = formatTs(log.created_at)
                  const detail = formatDetails(log.details)
                  return (
                    <tr key={log.id}
                      style={{ borderBottom: i < displayed.length - 1 ? '1px solid var(--color-brand-border)' : 'none' }}>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <p className="text-xs font-mono" style={{ color: 'var(--color-brand-text)' }}>{time}</p>
                        <p className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>{date}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs" style={{ color: 'var(--color-brand-text)' }}>
                          {log.users?.name ?? <span style={{ color: 'var(--color-brand-muted)' }}>System</span>}
                        </p>
                        <p className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                          {log.users?.employee_id ?? ''}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold" style={{ color: actionColor(log.action) }}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs max-w-xs" style={{ color: 'var(--color-brand-muted)' }}>
                        {detail ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--color-brand-muted)' }}>
                        {log.ip_address ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && logs.length === 500 && (
          <p className="px-4 py-3 text-xs text-center"
            style={{ borderTop: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}>
            Showing latest 500 events — use date filter to narrow results
          </p>
        )}
      </div>
    </Layout>
  )
}
