import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import * as XLSX from 'xlsx'
import { ClipboardList, Download, Search, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react'

const POOL_MIN    = 30
const EASY_FLOOR  = 10   // min attempts before flagging
const TOO_EASY    = 90   // % threshold — question may be too easy
const TOO_HARD    = 40   // % threshold — question may be too hard

const DIFF_LABEL  = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }

function accColor(pct) {
  if (pct === null) return 'var(--color-brand-muted)'
  if (pct < 60)     return 'var(--color-brand-danger)'
  if (pct < 75)     return 'var(--color-brand-warning)'
  return 'var(--color-brand-success)'
}

function effectivenessFlag(pct, shown) {
  if (shown < EASY_FLOOR) return null
  if (pct >= TOO_EASY)    return { label: 'Too Easy',  bg: '#0f1f2f', color: 'var(--color-brand-blue)' }
  if (pct <= TOO_HARD)    return { label: 'Too Hard',  bg: '#1f0a0a', color: '#fca5a5' }
  return null
}

function SortHeader({ label, col, sort, onSort }) {
  const active = sort.col === col
  return (
    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest cursor-pointer select-none"
      style={{ color: active ? 'var(--color-brand-gold)' : 'var(--color-brand-muted)' }}
      onClick={() => onSort(col)}>
      <span className="flex items-center gap-1">
        {label}
        {active
          ? sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronDown size={12} style={{ opacity: 0.3 }} />}
      </span>
    </th>
  )
}

export default function QuestionStats() {
  const [questions, setQuestions] = useState([])
  const [games,     setGames]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')

  // Filters
  const [filterGame,   setFilterGame]   = useState('all')
  const [filterDiff,   setFilterDiff]   = useState('all')
  const [filterStatus, setFilterStatus] = useState('active')

  // Sort
  const [sort, setSort] = useState({ col: 'times_shown', dir: 'desc' })

  const toggleSort = (col) => {
    setSort(s => s.col === col
      ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'desc' })
  }

  useEffect(() => {
    Promise.all([
      supabase.from('questions')
        .select('id, question_text, category, difficulty, times_shown, times_correct, is_active, game_id, games(name)')
        .order('times_shown', { ascending: false })
        .limit(500),
      supabase.from('games').select('id, name').eq('is_active', true),
    ]).then(([qRes, gRes]) => {
      setQuestions(qRes.data ?? [])
      setGames(gRes.data ?? [])
      setLoading(false)
    })
  }, [])

  // Pool health per game (active questions only)
  const poolHealth = useMemo(() => {
    const counts = {}
    for (const q of questions) {
      if (!q.is_active) continue
      const key  = q.game_id ?? 'procedure'
      const name = q.games?.name ?? 'Procedures'
      counts[key] = counts[key] ?? { name, count: 0 }
      counts[key].count++
    }
    return Object.values(counts).filter(g => g.count < POOL_MIN)
  }, [questions])

  // Filtered + sorted list
  const displayed = useMemo(() => {
    let list = questions.filter(q => {
      if (filterGame !== 'all' && (q.game_id ?? 'procedure') !== filterGame) return false
      if (filterDiff !== 'all' && String(q.difficulty) !== filterDiff)        return false
      if (filterStatus === 'active'   && !q.is_active)  return false
      if (filterStatus === 'inactive' && q.is_active)   return false
      if (filterStatus === 'unshown'  && q.times_shown > 0) return false
      const s = search.toLowerCase()
      if (s && !q.question_text.toLowerCase().includes(s) &&
               !(q.games?.name ?? '').toLowerCase().includes(s) &&
               !q.category.toLowerCase().includes(s)) return false
      return true
    })

    list = [...list].sort((a, b) => {
      let va, vb
      if (sort.col === 'accuracy') {
        va = a.times_shown ? a.times_correct / a.times_shown : -1
        vb = b.times_shown ? b.times_correct / b.times_shown : -1
      } else if (sort.col === 'game_id') {
        va = a.games?.name ?? 'Procedure'
        vb = b.games?.name ?? 'Procedure'
      } else {
        va = a[sort.col] ?? 0
        vb = b[sort.col] ?? 0
      }
      return sort.dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })

    return list
  }, [questions, filterGame, filterDiff, filterStatus, search, sort])

  // Summary stats (over all active questions)
  const activeQs   = questions.filter(q => q.is_active)
  const shownQs    = activeQs.filter(q => q.times_shown > 0)
  const avgAcc     = shownQs.length
    ? Math.round(shownQs.reduce((s, q) => s + (q.times_correct / q.times_shown), 0) / shownQs.length * 100)
    : null
  const flaggedQs  = shownQs.filter(q => {
    const pct = Math.round((q.times_correct / q.times_shown) * 100)
    return (pct >= TOO_EASY || pct <= TOO_HARD) && q.times_shown >= EASY_FLOOR
  })
  const neverShown = activeQs.filter(q => q.times_shown === 0).length

  const exportExcel = () => {
    const rows = displayed.map(q => {
      const pct = q.times_shown ? Math.round((q.times_correct / q.times_shown) * 100) : ''
      const flag = q.times_shown >= EASY_FLOOR ? effectivenessFlag(pct, q.times_shown) : null
      return {
        'Game':          q.games?.name ?? 'Procedure',
        'Category':      q.category,
        'Difficulty':    DIFF_LABEL[q.difficulty] ?? q.difficulty,
        'Question':      q.question_text,
        'Times Shown':   q.times_shown,
        'Times Correct': q.times_correct,
        'Accuracy %':    pct,
        'Flag':          flag?.label ?? '',
        'Active':        q.is_active ? 'Yes' : 'No',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Question Stats')
    ws['!cols'] = [
      { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 60 },
      { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
    ]
    XLSX.writeFile(wb, `question_stats_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <ClipboardList size={16} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Question Stats</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Accuracy, exposure, and effectiveness per question</p>
          </div>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium self-start"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-gold)' }}>
          <Download size={16} /> Export Excel
        </button>
      </div>

      {/* Pool health warnings */}
      {poolHealth.map(g => (
        <div key={g.name} className="flex items-center gap-2 p-3 rounded-lg mb-3 text-sm"
          style={{ background: '#1c1a0f', border: '1px solid var(--color-brand-warning)', color: 'var(--color-brand-warning)' }}>
          <AlertTriangle size={15} className="shrink-0" />
          <span><strong>{g.name}</strong> has only {g.count} active questions — below the minimum of {POOL_MIN}.</span>
        </div>
      ))}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active Questions', value: activeQs.length,  color: 'var(--color-brand-text)' },
          { label: 'Avg Accuracy',     value: avgAcc != null ? `${avgAcc}%` : '—', color: avgAcc != null ? accColor(avgAcc) : 'var(--color-brand-muted)' },
          { label: 'Flagged',          value: flaggedQs.length, color: flaggedQs.length ? 'var(--color-brand-warning)' : 'var(--color-brand-muted)' },
          { label: 'Never Shown',      value: neverShown,       color: neverShown ? '#fb923c' : 'var(--color-brand-muted)' },
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

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
          <Search size={15} style={{ color: 'var(--color-brand-muted)', flexShrink: 0 }} />
          <input type="text" placeholder="Search questions…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-32 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-brand-text)' }} />

          <select value={filterGame} onChange={e => setFilterGame(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
            <option value="all">All games</option>
            {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            <option value="procedure">Procedures</option>
          </select>

          <select value={filterDiff} onChange={e => setFilterDiff(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
            <option value="all">All difficulties</option>
            <option value="1">Easy</option>
            <option value="2">Medium</option>
            <option value="3">Hard</option>
          </select>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="unshown">Never shown</option>
            <option value="all">All</option>
          </select>

          <span className="text-xs ml-auto" style={{ color: 'var(--color-brand-muted)' }}>
            {displayed.length} question{displayed.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-brand-gold)' }} />
          </div>
        ) : displayed.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>
            No questions match the current filters.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest"
                    style={{ color: 'var(--color-brand-muted)' }}>Question</th>
                  <SortHeader label="Game"     col="game_id"       sort={sort} onSort={toggleSort} />
                  <SortHeader label="Diff"     col="difficulty"    sort={sort} onSort={toggleSort} />
                  <SortHeader label="Shown"    col="times_shown"   sort={sort} onSort={toggleSort} />
                  <SortHeader label="Correct"  col="times_correct" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Accuracy" col="accuracy"      sort={sort} onSort={toggleSort} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {displayed.map((q, i) => {
                  const pct  = q.times_shown ? Math.round((q.times_correct / q.times_shown) * 100) : null
                  const flag = pct !== null ? effectivenessFlag(pct, q.times_shown) : null
                  return (
                    <tr key={q.id}
                      style={{
                        borderBottom: i < displayed.length - 1 ? '1px solid var(--color-brand-border)' : 'none',
                        opacity: q.is_active ? 1 : 0.45,
                      }}>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-sm truncate" style={{ color: 'var(--color-brand-text)' }}>{q.question_text}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-brand-muted)' }}>{q.category}</p>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                        {q.games?.name ?? 'Procedure'}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                        {DIFF_LABEL[q.difficulty]}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--color-brand-text)' }}>
                        {q.times_shown === 0
                          ? <span style={{ color: '#fb923c' }}>0</span>
                          : q.times_shown}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--color-brand-text)' }}>
                        {q.times_correct}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: accColor(pct) }}>
                        {pct !== null ? `${pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {flag && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ background: flag.bg, color: flag.color }}>
                            {flag.label}
                          </span>
                        )}
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
