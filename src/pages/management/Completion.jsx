import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { CheckSquare, Download, AlertTriangle, Flag, X, FileCheck } from 'lucide-react'

const REQUIRED = 20

function daysLeftInMonth() {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return lastDay - now.getDate()
}

function monthLabel(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

// Urgency: On Track | At Risk | Below Target | Flagged (month over)
function getStatus(count, daysLeft) {
  if (count >= REQUIRED) return 'on-track'
  if (daysLeft === 0)    return 'flagged'
  const needed = REQUIRED - count
  if (needed / daysLeft > 1.5) return 'at-risk'
  return 'below-target'
}

const STATUS_META = {
  'flagged':      { label: 'Flagged',       bg: '#2a0a0a', color: '#fca5a5' },
  'at-risk':      { label: 'At Risk',       bg: '#2a1a0a', color: '#fb923c' },
  'below-target': { label: 'Below Target',  bg: '#1c1a0f', color: 'var(--color-brand-warning)' },
  'on-track':     { label: 'On Track',      bg: '#0f2f0f', color: 'var(--color-brand-success)' },
}

const STATUS_ORDER = { 'flagged': 0, 'at-risk': 1, 'below-target': 2, 'on-track': 3 }

// Key includes the previous month so dismissal auto-expires next month
function lastMonthDismissKey() {
  const d = new Date()
  const year  = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()
  const month = String(d.getMonth() === 0 ? 12 : d.getMonth()).padStart(2, '0')
  return `completion_dismissed_${year}-${month}`
}

export default function Completion() {
  const [agents,        setAgents]        = useState([])
  const [lastMonthMap,  setLastMonthMap]  = useState({})
  const [loading,       setLoading]       = useState(true)
  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem(lastMonthDismissKey()) === 'true'
  )
  const daysLeft = daysLeftInMonth()

  const dismissBanner = useCallback(() => {
    localStorage.setItem(lastMonthDismissKey(), 'true')
    setBannerDismissed(true)
  }, [])

  useEffect(() => {
    const now = new Date()
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(),     1).toISOString()

    Promise.all([
      supabase.rpc('get_all_agents'),
      supabase
        .from('sessions')
        .select('user_id')
        .eq('status', 'completed')
        .gte('completed_at', firstOfLastMonth)
        .lt('completed_at', firstOfThisMonth),
    ]).then(([agentsRes, lastRes]) => {
      setAgents(agentsRes.data ?? [])

      const map = {}
      for (const s of lastRes.data ?? []) {
        map[s.user_id] = (map[s.user_id] ?? 0) + 1
      }
      setLastMonthMap(map)
      setLoading(false)
    })
  }, [])

  const enriched = agents.map(a => {
    const count        = Number(a.sessions_this_month ?? 0)
    const status       = getStatus(count, daysLeft)
    const lastCount    = lastMonthMap[a.id] ?? 0
    const missedLast   = lastCount < REQUIRED
    return { ...a, count, status, lastCount, missedLast }
  }).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  const flaggedCount     = enriched.filter(a => a.status === 'flagged').length
  const atRiskCount      = enriched.filter(a => a.status === 'at-risk').length
  const belowTargetCount = enriched.filter(a => a.status === 'below-target').length
  const onTrackCount     = enriched.filter(a => a.status === 'on-track').length
  const missedLastCount  = enriched.filter(a => a.missedLast).length

  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const rows = enriched.map(a => ({
      'Employee ID':         a.employee_id,
      'Name':                a.name,
      'Sessions (Month)':    a.count,
      'Required':            REQUIRED,
      'Status':              STATUS_META[a.status].label,
      'Last Month Sessions': a.lastCount,
      'Missed Last Month':   a.missedLast ? 'Yes' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Completion Tracker')
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 18 }]
    XLSX.writeFile(wb, `completion_tracker_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const [complianceLoading, setComplianceLoading] = useState(false)

  const exportComplianceRecords = useCallback(async () => {
    setComplianceLoading(true)
    const XLSX = await import('xlsx')
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const label = now.toLocaleString('default', { month: 'long', year: 'numeric' })

    const { data: sessions } = await supabase
      .from('sessions')
      .select('user_id, score, total_time_seconds, completed_at, started_at, users(name, employee_id)')
      .eq('status', 'completed')
      .gte('completed_at', firstOfMonth)
      .order('completed_at', { ascending: true })

    const wb = XLSX.utils.book_new()

    // Sheet 1 — Summary
    const summaryRows = enriched.map(a => ({
      'Employee ID':      a.employee_id,
      'Name':             a.name,
      'Sessions':         a.count,
      'Required':         REQUIRED,
      'Status':           STATUS_META[a.status].label,
      'Compliant':        a.status === 'on-track' ? 'Yes' : 'No',
      'Prev Month':       a.lastCount,
      'Missed Prev':      a.missedLast ? 'Yes' : 'No',
    }))
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    wsSummary['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

    // Sheet 2 — Session Detail
    const detailRows = (sessions ?? []).map(s => ({
      'Employee ID':   s.users?.employee_id ?? '—',
      'Name':          s.users?.name ?? '—',
      'Date':          new Date(s.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      'Time':          new Date(s.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      'Score':         s.score ?? '',
      'Duration (min)': s.total_time_seconds ? Math.round(s.total_time_seconds / 60) : '',
    }))
    const wsDetail = XLSX.utils.json_to_sheet(detailRows)
    wsDetail['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Session Detail')

    const filename = `compliance_records_${label.replace(' ', '_')}_${now.toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, filename)
    setComplianceLoading(false)
  }, [enriched])

  const urgentCount = flaggedCount + atRiskCount + belowTargetCount

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <CheckSquare size={16} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Completion Tracker</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
              {monthLabel()} — {REQUIRED} sessions required &nbsp;·&nbsp;
              <span style={{ color: daysLeft <= 3 ? '#fb923c' : 'var(--color-brand-muted)' }}>
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button onClick={exportComplianceRecords} disabled={complianceLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}
            title="Export compliance training records (Summary + Session Detail)">
            {complianceLoading
              ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-brand-muted)' }} />
              : <FileCheck size={15} />}
            Compliance Records
          </button>
          <button onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-gold)' }}>
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {urgentCount > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg mb-5 text-sm"
          style={{ background: '#1c1a0f', border: '1px solid var(--color-brand-warning)', color: 'var(--color-brand-warning)' }}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            {urgentCount} agent{urgentCount > 1 ? 's are' : ' is'} below the monthly target.
            {flaggedCount > 0 && ` ${flaggedCount} flagged for missing this month's requirement.`}
          </span>
        </div>
      )}

      {/* Last month flag banner */}
      {missedLastCount > 0 && !bannerDismissed && (
        <div className="flex items-start gap-2 p-3 rounded-lg mb-5 text-sm"
          style={{ background: '#1a0a0a', border: '1px solid #fca5a5', color: '#fca5a5' }}>
          <Flag size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1">
            {missedLastCount} agent{missedLastCount > 1 ? 's' : ''} did not meet the {REQUIRED}-session target in {monthLabel(-1)}.
          </span>
          <button onClick={dismissBanner} className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity"
            aria-label="Dismiss" style={{ color: '#fca5a5' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'On Track',     value: onTrackCount,     color: 'var(--color-brand-success)',  border: onTrackCount > 0 ? 'var(--color-brand-success)' : 'var(--color-brand-border)' },
          { label: 'Below Target', value: belowTargetCount, color: 'var(--color-brand-warning)', border: belowTargetCount > 0 ? 'var(--color-brand-warning)' : 'var(--color-brand-border)' },
          { label: 'At Risk',      value: atRiskCount,      color: '#fb923c',                    border: atRiskCount > 0 ? '#fb923c' : 'var(--color-brand-border)' },
          { label: 'Flagged',      value: flaggedCount,     color: '#fca5a5',                    border: flaggedCount > 0 ? '#fca5a5' : 'var(--color-brand-border)' },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-4"
            style={{ background: 'var(--color-brand-card)', border: `1px solid ${c.border}` }}>
            <p className="text-xs font-medium uppercase tracking-widest mb-1"
              style={{ color: 'var(--color-brand-muted)' }}>{c.label}</p>
            <p className="text-3xl font-bold font-mono" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-brand-gold)' }} />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                  {['Agent', 'Sessions', 'Progress', 'Needed', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest"
                      style={{ color: 'var(--color-brand-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map((a, i) => {
                  const pct    = Math.min(100, Math.round((a.count / REQUIRED) * 100))
                  const needed = Math.max(0, REQUIRED - a.count)
                  const meta   = STATUS_META[a.status]
                  return (
                    <tr key={a.id} style={{ borderBottom: i < enriched.length - 1 ? '1px solid var(--color-brand-border)' : 'none' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium" style={{ color: 'var(--color-brand-text)' }}>{a.name}</p>
                            <p className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>{a.employee_id}</p>
                          </div>
                          {a.missedLast && (
                            <span title={`Missed ${monthLabel(-1)} target (${a.lastCount}/${REQUIRED})`}
                              className="px-1.5 py-0.5 rounded text-xs font-medium"
                              style={{ background: '#2a0a0a', color: '#fca5a5' }}>
                              prev
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: meta.color }}>
                        {a.count} / {REQUIRED}
                      </td>
                      <td className="px-4 py-3 w-44">
                        <div className="h-1.5 rounded-full" style={{ background: 'var(--color-brand-border)' }}>
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, background: meta.color }} />
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-brand-muted)' }}>{pct}%</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: needed === 0 ? 'var(--color-brand-muted)' : meta.color }}>
                        {needed === 0 ? '—' : `${needed} more`}
                        {needed > 0 && daysLeft > 0 && (
                          <span className="block" style={{ color: 'var(--color-brand-muted)' }}>
                            {(needed / daysLeft).toFixed(1)}/day
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-md text-xs font-medium"
                          style={{ background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
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
