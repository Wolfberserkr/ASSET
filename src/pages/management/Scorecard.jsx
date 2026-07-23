import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { exportXlsx } from '../../lib/exportXlsx'
import {
  BarChart3, Download, AlertTriangle, ArrowUp, ArrowDown, Minus,
} from 'lucide-react'

const MONTHS = 6

function monthShort(d) {
  return new Date(d + 'T00:00:00').toLocaleString('en-US', { month: 'short', year: '2-digit' })
}
function monthLong(d) {
  return new Date(d + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

// KPI definitions — how each metric reads off a scorecard row.
const KPIS = [
  { key: 'avg_score',      label: 'Avg Score',    fmt: v => v == null ? '—' : Number(v).toFixed(0), suffix: '' },
  { key: 'total_sessions', label: 'Sessions',     fmt: v => Number(v ?? 0),                          suffix: '' },
  { key: 'active_agents',  label: 'Active',       fmt: v => Number(v ?? 0),                          suffix: '' },
  { key: 'recert_rate',    label: 'Recert Rate',  fmt: v => `${Number(v ?? 0)}`,                     suffix: '%' },
  { key: 'avg_accuracy',   label: 'Accuracy',     fmt: v => `${Number(v ?? 0)}`,                     suffix: '%' },
]

function Delta({ curr, prev, suffix }) {
  if (prev == null || curr == null) return null
  const d = Number(curr) - Number(prev)
  const rounded = Math.round(d * 10) / 10
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: 'var(--color-brand-muted)' }}>
        <Minus size={12} /> 0{suffix}
      </span>
    )
  }
  const up = rounded > 0
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold"
      style={{ color: up ? 'var(--color-brand-success)' : '#fca5a5' }}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(rounded)}{suffix}
    </span>
  )
}

// Minimal inline sparkline (same hand-rolled SVG approach as ScoreTrend).
function Sparkline({ values, color = 'var(--color-brand-cyan)' }) {
  const nums = values.map(v => Number(v ?? 0))
  const w = 120, h = 34, pad = 3
  const max = Math.max(...nums, 1)
  const min = Math.min(...nums, 0)
  const span = max - min || 1
  const pts = nums.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(nums.length - 1, 1)
    const y = h - pad - ((v - min) / span) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6"
        strokeLinejoin="round" strokeLinecap="round" />
      {pts.length > 0 && (() => {
        const [cx, cy] = pts[pts.length - 1].split(',')
        return <circle cx={cx} cy={cy} r="2.4" fill={color} />
      })()}
    </svg>
  )
}

export default function Scorecard() {
  const [rows,     setRows]     = useState([])   // ascending months
  const [games,    setGames]    = useState([])   // per-game per-month accuracy
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [scRes, gRes] = await Promise.all([
      supabase.rpc('get_department_scorecard', { p_months: MONTHS }),
      supabase.rpc('get_department_scorecard_games', { p_months: MONTHS }),
    ])
    if (scRes.error) { setError(scRes.error.message); setLoading(false); return }
    setRows(scRes.data ?? [])
    if (gRes.error) console.error('scorecard games:', gRes.error)
    setGames(gRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const latest = rows[rows.length - 1]
  const prev   = rows[rows.length - 2]
  const monthCols = rows.map(r => r.month)

  // Pivot per-game accuracy into { gameName: { month: accuracy } }.
  const gamePivot = {}
  for (const g of games) {
    gamePivot[g.game_name] ??= {}
    gamePivot[g.game_name][g.month] = g.accuracy
  }
  const gameNames = Object.keys(gamePivot).sort()

  const exportExcel = () => {
    const scoreRows = rows.map(r => ({
      'Month':            monthLong(r.month),
      'Avg Score':        r.avg_score != null ? Number(r.avg_score) : '',
      'Completed Sessions': Number(r.total_sessions ?? 0),
      'Active Drill-takers': Number(r.active_agents ?? 0),
      'Roster':           Number(r.roster ?? 0),
      'Recert Met':       Number(r.recert_met ?? 0),
      'Recert Rate %':    Number(r.recert_rate ?? 0),
      'Avg Accuracy %':   Number(r.avg_accuracy ?? 0),
    }))
    const gameRows = gameNames.map(name => {
      const row = { 'Game': name }
      for (const m of monthCols) row[monthShort(m)] = gamePivot[name][m] != null ? Number(gamePivot[name][m]) : ''
      return row
    })
    exportXlsx({
      filename: 'stellaris_scorecard',
      sheets: [
        { name: 'Scorecard', rows: scoreRows, cols: [{ wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }] },
        { name: 'Per-Game Accuracy', rows: gameRows },
      ],
    })
  }

  const accColor = (v) => v == null ? 'var(--color-brand-muted)'
    : Number(v) < 60 ? '#fca5a5' : Number(v) < 75 ? 'var(--color-brand-warning)' : 'var(--color-brand-success)'

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <BarChart3 size={16} style={{ color: 'var(--color-brand-cyan)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Department Scorecard</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
              Month over month · last {MONTHS} months
            </p>
          </div>
        </div>
        <button onClick={exportExcel} disabled={!rows.length}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium self-start"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-cyan)', opacity: rows.length ? 1 : 0.5 }}>
          <Download size={16} /> Export Excel
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm"
          style={{ background: '#1f0a0a', border: '1px solid var(--color-brand-danger)', color: '#fca5a5' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-brand-cyan)' }} />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>No data yet.</p>
      ) : (
        <>
          {/* MTD note */}
          <p className="text-xs mb-4" style={{ color: 'var(--color-brand-muted)' }}>
            Deltas compare {latest && monthLong(latest.month)} <strong>(month to date)</strong> with {prev && monthLong(prev.month)}.
          </p>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {KPIS.map(kpi => (
              <div key={kpi.key} className="rounded-xl p-4"
                style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--color-brand-muted)' }}>{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>
                    {latest ? kpi.fmt(latest[kpi.key]) : '—'}<span className="text-sm">{kpi.suffix}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-[34px]">
                  <Sparkline values={rows.map(r => r[kpi.key])} />
                </div>
                <div className="mt-1">
                  <Delta curr={latest?.[kpi.key]} prev={prev?.[kpi.key]} suffix={kpi.suffix} />
                  <span className="text-[10px] ml-1" style={{ color: 'var(--color-brand-muted)' }}>vs prev</span>
                </div>
              </div>
            ))}
          </div>

          {/* Month table */}
          <div className="rounded-xl overflow-hidden mb-6"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>Monthly detail</p>
            </div>
            <div className="table-responsive">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                    {['Month', 'Avg Score', 'Sessions', 'Active', 'Recert', 'Accuracy'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-medium uppercase tracking-widest"
                        style={{ color: 'var(--color-brand-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice().reverse().map((r, i, arr) => {
                    const isLatest = i === 0
                    return (
                      <tr key={r.month} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-brand-border)' : 'none' }}>
                        <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-brand-text)' }}>
                          {monthShort(r.month)}{isLatest && <span className="text-[10px] ml-1" style={{ color: 'var(--color-brand-cyan)' }}>MTD</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-brand-text)' }}>{r.avg_score != null ? Number(r.avg_score).toFixed(0) : '—'}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-brand-text)' }}>{Number(r.total_sessions ?? 0)}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-brand-text)' }}>{Number(r.active_agents ?? 0)}/{Number(r.roster ?? 0)}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: Number(r.recert_rate) >= 80 ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }}>{Number(r.recert_rate ?? 0)}%</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: accColor(r.avg_accuracy) }}>{Number(r.avg_accuracy ?? 0)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-game accuracy */}
          {gameNames.length > 0 && (
            <div className="rounded-xl overflow-hidden"
              style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>Per-game accuracy (%)</p>
              </div>
              <div className="table-responsive">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                      <th className="text-left px-4 py-2.5 text-[11px] font-medium uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Game</th>
                      {monthCols.map(m => (
                        <th key={m} className="text-left px-3 py-2.5 text-[11px] font-medium uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>{monthShort(m)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gameNames.map((name, i) => (
                      <tr key={name} style={{ borderBottom: i < gameNames.length - 1 ? '1px solid var(--color-brand-border)' : 'none' }}>
                        <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-brand-text)' }}>{name}</td>
                        {monthCols.map(m => {
                          const v = gamePivot[name][m]
                          return (
                            <td key={m} className="px-3 py-2.5 font-mono" style={{ color: accColor(v) }}>
                              {v != null ? `${Number(v)}` : '·'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
