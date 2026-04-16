import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import * as XLSX from 'xlsx'
import { CheckSquare, Download, AlertTriangle } from 'lucide-react'

export default function Completion() {
  const [agents,  setAgents]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_all_agents').then(({ data }) => {
      setAgents(data ?? [])
      setLoading(false)
    })
  }, [])

  const exportExcel = () => {
    const rows = agents.map(a => ({
      'Employee ID':       a.employee_id,
      'Name':              a.name,
      'Sessions (Month)':  Number(a.sessions_this_month ?? 0),
      'Required':          20,
      'Status':            Number(a.sessions_this_month ?? 0) >= 20 ? 'On Track' : 'Below Target',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Completion Tracker')
    XLSX.writeFile(wb, `completion_tracker_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const belowTarget = agents.filter(a => Number(a.sessions_this_month ?? 0) < 20)
  const onTrack     = agents.filter(a => Number(a.sessions_this_month ?? 0) >= 20)

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <CheckSquare size={16} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Completion Tracker</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
              Monthly recertification — 20 sessions required
            </p>
          </div>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium self-start"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-gold)' }}
          aria-label="Export completion tracker to Excel">
          <Download size={16} /> Export Excel
        </button>
      </div>

      {belowTarget.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg mb-5 text-sm"
          style={{ background: '#1c1a0f', border: '1px solid var(--color-brand-warning)', color: 'var(--color-brand-warning)' }}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{belowTarget.length} agent{belowTarget.length > 1 ? 's are' : ' is'} below the monthly target and will be flagged at month end.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-success)' }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--color-brand-muted)' }}>On Track</p>
          <p className="text-3xl font-bold font-mono" style={{ color: 'var(--color-brand-success)' }}>{onTrack.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-brand-card)', border: `1px solid ${belowTarget.length ? 'var(--color-brand-warning)' : 'var(--color-brand-border)'}` }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--color-brand-muted)' }}>Below Target</p>
          <p className="text-3xl font-bold font-mono" style={{ color: belowTarget.length ? 'var(--color-brand-warning)' : 'var(--color-brand-muted)' }}>
            {belowTarget.length}
          </p>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
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
                {['Agent', 'Sessions', 'Progress', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest"
                    style={{ color: 'var(--color-brand-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a, i) => {
                const count   = Number(a.sessions_this_month ?? 0)
                const pct     = Math.min(100, Math.round((count / 20) * 100))
                const onTrack = count >= 20
                return (
                  <tr key={a.id} style={{ borderBottom: i < agents.length - 1 ? '1px solid var(--color-brand-border)' : 'none' }}>
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--color-brand-text)' }}>{a.name}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>{a.employee_id}</p>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold"
                      style={{ color: onTrack ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }}>
                      {count} / 20
                    </td>
                    <td className="px-4 py-3 w-48">
                      <div className="h-1.5 rounded-full" style={{ background: 'var(--color-brand-border)' }}>
                        <div className="h-1.5 rounded-full" style={{
                          width: `${pct}%`,
                          background: onTrack ? 'var(--color-brand-success)' : 'var(--color-brand-warning)',
                        }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-brand-muted)' }}>{pct}%</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-md text-xs font-medium" style={{
                        background: onTrack ? '#0f2f0f' : '#1c1a0f',
                        color: onTrack ? 'var(--color-brand-success)' : 'var(--color-brand-warning)',
                      }}>
                        {onTrack ? 'On Track' : 'Below Target'}
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
