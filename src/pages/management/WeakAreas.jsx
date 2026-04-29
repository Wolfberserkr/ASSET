import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { BarChart2, Download, AlertTriangle, Users, HelpCircle } from 'lucide-react'

const DATE_RANGES = [
  { label: 'Last 30 days',  value: '30' },
  { label: 'Last 90 days',  value: '90' },
  { label: 'Last 6 months', value: '180' },
  { label: 'All time',      value: 'all' },
]

const barColor = pct =>
  pct < 60 ? 'var(--color-brand-danger)'
  : pct < 75 ? 'var(--color-brand-warning)'
  : 'var(--color-brand-success)'

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
        <Icon size={14} style={{ color: 'var(--color-brand-gold)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WeakAreas() {
  const [gameStats,    setGameStats]    = useState([])
  const [worstQs,      setWorstQs]      = useState([])
  const [agentRows,    setAgentRows]    = useState([])
  const [gameNames,    setGameNames]    = useState({})   // id → name
  const [agents,       setAgents]       = useState([])   // [{id,name,employee_id}]
  const [loading,      setLoading]      = useState(true)

  // Filters
  const [dateRange,     setDateRange]     = useState('90')
  const [selectedAgent, setSelectedAgent] = useState('all')
  const [selectedGame,  setSelectedGame]  = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true)

    const dateFrom = dateRange === 'all'
      ? null
      : new Date(Date.now() - Number(dateRange) * 86400000).toISOString()

    // 1. Games + agents (static-ish, always fetch)
    const [gamesRes, agentsRes] = await Promise.all([
      supabase.from('games').select('id, name'),
      supabase.from('users').select('id, name, employee_id').eq('role', 'agent').eq('is_active', true),
    ])
    const gMap = Object.fromEntries((gamesRes.data ?? []).map(g => [g.id, g.name]))
    setGameNames(gMap)
    const agentList = agentsRes.data ?? []
    setAgents(agentList)

    // 2. Completed sessions matching date + agent filter
    let sQ = supabase.from('sessions').select('id, user_id').eq('status', 'completed')
    if (dateFrom)                    sQ = sQ.gte('completed_at', dateFrom)
    if (selectedAgent !== 'all')     sQ = sQ.eq('user_id', selectedAgent)
    const { data: sessions } = await sQ

    if (!sessions?.length) {
      setGameStats([]); setWorstQs([]); setAgentRows([]); setLoading(false); return
    }

    const sessionIds  = sessions.map(s => s.id)
    const sessionUser = Object.fromEntries(sessions.map(s => [s.id, s.user_id]))

    // 3. Answers — batch if needed (Supabase .in() supports up to 1000 items)
    let aQ = supabase
      .from('session_answers')
      .select('session_id, question_id, game_id, is_correct')
      .in('session_id', sessionIds)
    if (selectedGame !== 'all') aQ = aQ.eq('game_id', selectedGame)
    const { data: answers } = await aQ

    // 4. Questions (for text + category)
    const questionIds = [...new Set((answers ?? []).map(a => a.question_id))]
    const { data: questions } = questionIds.length
      ? await supabase.from('questions').select('id, question_text, category').in('id', questionIds)
      : { data: [] }
    const qMap = Object.fromEntries((questions ?? []).map(q => [q.id, q]))

    // ── Compute game stats ──────────────────────────────────────────────────
    const gBucket = {}
    for (const a of answers ?? []) {
      const key  = a.game_id ?? 'procedure'
      const name = gMap[a.game_id] ?? 'Procedures'
      if (!gBucket[key]) gBucket[key] = { name, correct: 0, total: 0 }
      gBucket[key].total++
      if (a.is_correct) gBucket[key].correct++
    }
    const gStats = Object.values(gBucket)
      .map(g => ({ ...g, pct: g.total ? Math.round((g.correct / g.total) * 100) : null }))
      .sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100))
    setGameStats(gStats)

    // ── Compute per-question stats ──────────────────────────────────────────
    const qBucket = {}
    for (const a of answers ?? []) {
      const qid = a.question_id
      if (!qBucket[qid]) {
        const q = qMap[qid]
        qBucket[qid] = {
          text:     q?.question_text ?? 'Unknown question',
          category: q?.category ?? '—',
          gameName: gMap[a.game_id] ?? 'Procedures',
          correct: 0, total: 0,
        }
      }
      qBucket[qid].total++
      if (a.is_correct) qBucket[qid].correct++
    }
    const worst = Object.values(qBucket)
      .filter(q => q.total >= 5)
      .map(q => ({ ...q, pct: Math.round((q.correct / q.total) * 100) }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10)
    setWorstQs(worst)

    // ── Compute per-agent × per-game stats ─────────────────────────────────
    const aBucket = {}
    for (const a of answers ?? []) {
      const uid  = sessionUser[a.session_id]
      const gkey = a.game_id ?? 'procedure'
      if (!uid) continue
      if (!aBucket[uid]) aBucket[uid] = {}
      if (!aBucket[uid][gkey]) aBucket[uid][gkey] = { correct: 0, total: 0 }
      aBucket[uid][gkey].total++
      if (a.is_correct) aBucket[uid][gkey].correct++
    }
    const rows = agentList
      .filter(ag => aBucket[ag.id])
      .map(ag => {
        const byGame = aBucket[ag.id]
        const allVals = Object.values(byGame)
        const totalC = allVals.reduce((s, x) => s + x.correct, 0)
        const totalT = allVals.reduce((s, x) => s + x.total,   0)
        return {
          id: ag.id, name: ag.name, employee_id: ag.employee_id,
          overall: totalT ? Math.round((totalC / totalT) * 100) : null,
          byGame,
        }
      })
      .sort((a, b) => (a.overall ?? 100) - (b.overall ?? 100))
    setAgentRows(rows)
    setLoading(false)
  }, [dateRange, selectedAgent, selectedGame])

  useEffect(() => { loadData() }, [loadData])

  // ── Export ────────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    const gameRows = gameStats.map(g => ({
      Game: g.name, Correct: g.correct, Total: g.total, 'Accuracy %': g.pct ?? '—',
    }))
    const ws1 = XLSX.utils.json_to_sheet(gameRows)
    ws1['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'By Game')

    const qRows = worstQs.map(q => ({
      Question: q.text, Game: q.gameName, Category: q.category,
      Correct: q.correct, Total: q.total, 'Accuracy %': q.pct,
    }))
    const ws2 = XLSX.utils.json_to_sheet(qRows)
    ws2['!cols'] = [{ wch: 60 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Worst Questions')

    const agentRows2 = agentRows.map(ag => {
      const row = { 'Name': ag.name, 'Employee ID': ag.employee_id, 'Overall %': ag.overall ?? '—' }
      for (const [gid, stats] of Object.entries(ag.byGame)) {
        const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : null
        row[gameNames[gid] ?? 'Procedures'] = pct ?? '—'
      }
      return row
    })
    const ws3 = XLSX.utils.json_to_sheet(agentRows2)
    XLSX.utils.book_append_sheet(wb, ws3, 'By Agent')

    XLSX.writeFile(wb, `weak_areas_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const overallPct = gameStats.length
    ? Math.round(gameStats.reduce((s, g) => s + g.correct, 0) /
        Math.max(1, gameStats.reduce((s, g) => s + g.total, 0)) * 100)
    : null

  // Game list for filter dropdown
  const gameOptions = Object.entries(gameNames)

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <BarChart2 size={16} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Weak Areas</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Accuracy breakdown by game, question, and agent</p>
          </div>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium self-start"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-gold)' }}>
          <Download size={16} /> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Date range */}
        <select value={dateRange} onChange={e => setDateRange(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
          {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        {/* Agent */}
        <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
          <option value="all">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        {/* Game */}
        <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
          <option value="all">All games</option>
          {gameOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-brand-gold)' }} />
        </div>
      ) : gameStats.length === 0 ? (
        <div className="rounded-xl p-10 text-center"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
          <p style={{ color: 'var(--color-brand-muted)' }}>No data for the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl p-4"
              style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
              <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--color-brand-muted)' }}>Overall Accuracy</p>
              <p className="text-3xl font-bold font-mono" style={{ color: overallPct != null ? barColor(overallPct) : 'var(--color-brand-muted)' }}>
                {overallPct != null ? `${overallPct}%` : '—'}
              </p>
            </div>
            <div className="rounded-xl p-4"
              style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
              <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--color-brand-muted)' }}>Weakest Game</p>
              <p className="text-lg font-bold truncate" style={{ color: 'var(--color-brand-danger)' }}>
                {gameStats[0]?.name ?? '—'}
              </p>
              {gameStats[0] && (
                <p className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>{gameStats[0].pct}% accuracy</p>
              )}
            </div>
            <div className="rounded-xl p-4 col-span-2 sm:col-span-1"
              style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
              <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--color-brand-muted)' }}>Total Answers</p>
              <p className="text-3xl font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>
                {gameStats.reduce((s, g) => s + g.total, 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* By Game */}
          <Section title="By Game" icon={BarChart2}>
            <div className="space-y-4">
              {gameStats.map(game => {
                const pct = game.pct ?? 0
                const c   = barColor(pct)
                return (
                  <div key={game.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-brand-text)' }}>{game.name}</span>
                      <div className="text-right">
                        <span className="font-bold font-mono" style={{ color: c }}>{game.pct ?? '—'}%</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--color-brand-muted)' }}>
                          {game.correct}/{game.total}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--color-brand-border)' }}>
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: c, transition: 'width 500ms ease-out' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Worst Questions */}
          {worstQs.length > 0 && (
            <Section title="Most-Failed Questions (min. 5 attempts)" icon={HelpCircle}>
              <div className="space-y-0 -mx-4 -mb-4">
                {worstQs.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3"
                    style={{ borderTop: i > 0 ? '1px solid var(--color-brand-border)' : 'none' }}>
                    <span className="text-lg font-bold font-mono w-7 shrink-0 text-right"
                      style={{ color: barColor(q.pct) }}>{q.pct}%</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: 'var(--color-brand-text)' }}>{q.text}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-brand-muted)' }}>
                        {q.gameName} · {q.category} · {q.correct}/{q.total} correct
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* By Agent */}
          {selectedAgent === 'all' && agentRows.length > 0 && (
            <Section title="By Agent" icon={Users}>
              <div className="-mx-4 -mb-4">
                <div className="table-responsive">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                        <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-widest"
                          style={{ color: 'var(--color-brand-muted)' }}>Agent</th>
                        {gameStats.map(g => (
                          <th key={g.name} className="text-right px-3 py-2 text-xs font-medium uppercase tracking-widest"
                            style={{ color: 'var(--color-brand-muted)' }}>
                            {g.name.split(' ')[0]}
                          </th>
                        ))}
                        <th className="text-right px-4 py-2 text-xs font-medium uppercase tracking-widest"
                          style={{ color: 'var(--color-brand-muted)' }}>Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentRows.map((ag, i) => {
                        // Build a map of gameName → pct for this agent
                        const agGamePct = {}
                        for (const [gid, stats] of Object.entries(ag.byGame)) {
                          agGamePct[gameNames[gid] ?? 'Procedures'] =
                            stats.total ? Math.round((stats.correct / stats.total) * 100) : null
                        }
                        return (
                          <tr key={ag.id}
                            style={{ borderTop: '1px solid var(--color-brand-border)' }}>
                            <td className="px-4 py-3">
                              <p className="font-medium" style={{ color: 'var(--color-brand-text)' }}>{ag.name}</p>
                              <p className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>{ag.employee_id}</p>
                            </td>
                            {gameStats.map(g => {
                              const pct = agGamePct[g.name]
                              return (
                                <td key={g.name} className="px-3 py-3 text-right font-mono text-sm"
                                  style={{ color: pct != null ? barColor(pct) : 'var(--color-brand-muted)' }}>
                                  {pct != null ? `${pct}%` : '—'}
                                </td>
                              )
                            })}
                            <td className="px-4 py-3 text-right font-mono font-bold"
                              style={{ color: ag.overall != null ? barColor(ag.overall) : 'var(--color-brand-muted)' }}>
                              {ag.overall != null ? `${ag.overall}%` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          )}
        </div>
      )}
    </Layout>
  )
}
