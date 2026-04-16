import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import * as XLSX from 'xlsx'
import { FileText, Download, Search } from 'lucide-react'

export default function AuditLog() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id, action, details, ip_address, created_at, user_id, users(name, employee_id)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { setLogs(data ?? []); setLoading(false) })
  }, [])

  const filtered = logs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.users?.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.users?.employee_id?.toLowerCase().includes(search.toLowerCase())
  )

  const exportExcel = () => {
    const rows = filtered.map(l => ({
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
    XLSX.writeFile(wb, `audit_log_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const actionColor = (action) => {
    if (action.includes('LOGIN'))    return 'var(--color-brand-blue)'
    if (action.includes('LOGOUT'))   return 'var(--color-brand-muted)'
    if (action.includes('PASSWORD')) return 'var(--color-brand-warning)'
    if (action.includes('FAIL') || action.includes('LOCK')) return 'var(--color-brand-danger)'
    return 'var(--color-brand-text)'
  }

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <FileText size={16} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Audit Log</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Last 200 events · append-only</p>
          </div>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium self-start"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-gold)' }}
          aria-label="Export audit log to Excel">
          <Download size={16} /> Export Excel
        </button>
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
        <div className="px-4 py-3 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
          <Search size={16} style={{ color: 'var(--color-brand-muted)' }} />
          <input type="text" placeholder="Search actions or agents…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--color-brand-text)' }} />
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-brand-gold)' }} />
          </div>
        ) : (
          <div className="table-responsive">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                {['Timestamp', 'Agent', 'Action', 'IP'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest"
                    style={{ color: 'var(--color-brand-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => {
                const date = new Date(log.created_at)
                return (
                  <tr key={log.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-brand-border)' : 'none' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                      {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs" style={{ color: 'var(--color-brand-text)' }}>{log.users?.name ?? '—'}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>{log.users?.employee_id ?? ''}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs font-semibold" style={{ color: actionColor(log.action) }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                      {log.ip_address ?? '—'}
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
