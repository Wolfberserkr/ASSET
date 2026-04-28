import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import StatCard from '../../components/StatCard'
import * as XLSX from 'xlsx'
import { ArrowLeft, Download, Trophy, Clock, CheckSquare, TrendingUp, Target, TrendingDown } from 'lucide-react'
import { computeDecay } from '../../lib/decayUtils'

// ── Score Trend Chart ─────────────────────────────────────────────────────────
function ScoreTrend({ sessions }) {
  const completed = [...sessions]
    .filter(s => s.status === 'completed')
    .reverse()
    .slice(-20)

  if (completed.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-sm"
        style={{ color: 'var(--color-brand-muted)' }}>
        Not enough data yet
      </div>
    )
  }

  const W = 480, H = 140, PAD = { top: 12, right: 16, bottom: 28, left: 36 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const maxScore = 150

  const xOf = i => PAD.left + (i / (completed.length - 1)) * innerW
  const yOf = v => PAD.top + innerH - (v / maxScore) * innerH

  const avg = completed.reduce((s, x) => s + x.score, 0) / completed.length
  const points = completed.map((s, i) => `${xOf(i)},${yOf(s.score)}`).join(' ')

  const yTicks = [0, 50, 100, 150]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
      {/* Grid lines */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right}
            y1={yOf(v)} y2={yOf(v)}
            stroke="var(--color-brand-border)" strokeWidth="1" />
          <text x={PAD.left - 6} y={yOf(v) + 4}
            textAnchor="end" fontSize="9" fill="var(--color-brand-muted)">{v}</text>
        </g>
      ))}

      {/* Avg line */}
      <line x1={PAD.left} x2={W - PAD.right}
        y1={yOf(avg)} y2={yOf(avg)}
        stroke="var(--color-brand-gold)" strokeWidth="1"
        strokeDasharray="4 3" opacity="0.5" />
      <text x={W - PAD.right + 3} y={yOf(avg) + 4}
        fontSize="8" fill="var(--color-brand-gold)" opacity="0.7">avg</text>

      {/* Area fill */}
      <polygon
        points={`${PAD.left},${PAD.top + innerH} ${points} ${W - PAD.right},${PAD.top + innerH}`}
        fill="var(--color-brand-gold)" opacity="0.06" />

      {/* Line */}
      <polyline points={points} fill="none"
        stroke="var(--color-brand-gold)" strokeWidth="2" strokeLinejoin="round" />

      {/* Dots */}
      {completed.map((s, i) => (
        <circle key={s.id} cx={xOf(i)} cy={yOf(s.score)} r="3"
          fill="var(--color-brand-gold)" stroke="var(--color-brand-card)" strokeWidth="1.5" />
      ))}

      {/* X-axis labels — first, last, and every ~5th */}
      {completed.map((s, i) => {
        const show = i === 0 || i === completed.length - 1 || (completed.length > 5 && i % 5 === 0)
        if (!show) return null
        const d = new Date(s.completed_at)
        const label = `${d.getMonth() + 1}/${d.getDate()}`
        return (
          <text key={s.id} x={xOf(i)} y={H - 4}
            textAnchor="middle" fontSize="9" fill="var(--color-brand-muted)">{label}</text>
        )
      })}
    </svg>
  )
}

// ── Per-Game Accuracy Bars ────────────────────────────────────────────────────
function GameAccuracy({ data }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm"
        style={{ color: 'var(--color-brand-muted)' }}>
        No answer data yet
      </div>
    )
  }

  const barColor = pct =>
    pct < 60 ? '#ef4444' : pct < 75 ? 'var(--color-brand-warning)' : 'var(--color-brand-success)'

  return (
    <div className="flex flex-col gap-3">
      {data.map(g => {
        const pct = g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0
        return (
          <div key={g.name}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm" style={{ color: 'var(--color-brand-text)' }}>{g.name}</span>
              <span className="text-xs font-mono" style={{ color: barColor(pct) }}>
                {pct}% <span style={{ color: 'var(--color-brand-muted)' }}>({g.correct}/{g.total})</span>
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden"
              style={{ background: 'var(--color-brand-border)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: barColor(pct) }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── UA Parser ────────────────────────────────────────────────────────────────
function parseUA(ua) {
  if (!ua) return '—'
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) && !/Chrome/.test(ua) ? 'Safari' :
    'Browser'
  const os =
    /Windows NT/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Linux/.test(ua) ? 'Linux' :
    'Unknown OS'
  return `${browser} · ${os}`
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agent,       setAgent]       = useState(null)
  const [sessions,    setSessions]    = useState([])
  const [gameAccuracy, setGameAccuracy] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!id) return

    Promise.all([
      supabase.from('users').select('*').eq('id', id).single(),
      supabase
        .from('sessions')
        .select('id, score, status, completed_at, total_time_seconds, total_questions, started_at, ip_address, user_agent')
        .eq('user_id', id)
        .in('status', ['completed', 'abandoned'])
        .order('started_at', { ascending: false })
        .limit(50),
      supabase.from('games').select('id, name'),
    ]).then(async ([agentRes, sessionsRes, gamesRes]) => {
      setAgent(agentRes.data)
      const allSessions = sessionsRes.data ?? []
      setSessions(allSessions)

      const completedIds = allSessions
        .filter(s => s.status === 'completed')
        .map(s => s.id)

      let accuracy = []
      if (completedIds.length > 0) {
        const { data: answers } = await supabase
          .from('session_answers')
          .select('is_correct, game_id')
          .in('session_id', completedIds)

        const gamesMap = Object.fromEntries((gamesRes.data ?? []).map(g => [g.id, g.name]))
        const byGame = {}
        for (const a of answers ?? []) {
          if (!a.game_id) continue
          if (!byGame[a.game_id]) byGame[a.game_id] = { name: gamesMap[a.game_id] ?? 'Unknown', correct: 0, total: 0 }
          byGame[a.game_id].total++
          if (a.is_correct) byGame[a.game_id].correct++
        }
        accuracy = Object.values(byGame).sort((a, b) =>
          (a.correct / a.total) - (b.correct / b.total))
      }
      setGameAccuracy(accuracy)
      setLoading(false)
    })
  }, [id])

  const completedSessions = sessions.filter(s => s.status === 'completed')
  const decayMap   = computeDecay(completedSessions.map(s => ({ user_id: id, score: s.score, completed_at: s.completed_at })))
  const decayInfo  = decayMap[id]
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
      {/* Header */}
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

      {/* Decay warning */}
      {decayInfo?.isDecaying && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm"
          style={{ background: '#1a0f1f', border: '1px solid #c084fc', color: '#c084fc' }}>
          <TrendingDown size={15} className="shrink-0" />
          <span>
            Score down <strong>{decayInfo.dropPct}%</strong> over the past 2 weeks —
            avg dropped from <strong>{decayInfo.priorAvg}</strong> to <strong>{decayInfo.recentAvg}</strong>.
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Avg Score"      value={avgScore}              icon={Trophy}      accent="var(--color-brand-gold)" />
        <StatCard label="This Month"     value={thisMonth}             icon={CheckSquare} accent={thisMonth >= 20 ? 'var(--color-brand-success)' : 'var(--color-brand-warning)'} sub="/ 20 required" />
        <StatCard label="Total Sessions" value={completedSessions.length} icon={Clock} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Score trend */}
        <div className="rounded-xl p-4"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} style={{ color: 'var(--color-brand-gold)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>Score Trend</span>
            <span className="text-xs ml-auto" style={{ color: 'var(--color-brand-muted)' }}>last 20 sessions</span>
          </div>
          <ScoreTrend sessions={sessions} />
        </div>

        {/* Per-game accuracy */}
        <div className="rounded-xl p-4"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Target size={14} style={{ color: 'var(--color-brand-gold)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>Per-Game Accuracy</span>
          </div>
          <GameAccuracy data={gameAccuracy} />
        </div>
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
                  {['Date', 'Status', 'Score', 'Duration', 'Device'].map(h => (
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
                        {s.total_time_seconds ? `${mins}m ${String(secs).padStart(2, '0')}s` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                        {parseUA(s.user_agent)}
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
