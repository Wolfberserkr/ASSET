import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import * as XLSX from 'xlsx'
import { BarChart2, Download } from 'lucide-react'

export default function WeakAreas() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Pull per-game accuracy from session_answers grouped by game
    supabase
      .from('session_answers')
      .select('game_id, is_correct, games(name)')
      .then(({ data: rows }) => {
        if (!rows) { setLoading(false); return }
        const gameMap = {}
        rows.forEach(r => {
          const key = r.game_id ?? 'procedure'
          const name = r.games?.name ?? 'Procedure'
          if (!gameMap[key]) gameMap[key] = { name, correct: 0, total: 0 }
          gameMap[key].total++
          if (r.is_correct) gameMap[key].correct++
        })
        const sorted = Object.values(gameMap)
          .map(g => ({ ...g, pct: g.total ? Math.round((g.correct / g.total) * 100) : null }))
          .sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100))
        setData(sorted)
        setLoading(false)
      })
  }, [])

  const exportExcel = () => {
    const rows = data.map(d => ({
      'Game':         d.name,
      'Total Answers': d.total,
      'Correct':      d.correct,
      'Accuracy %':   d.pct ?? '—',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Weak Areas')
    XLSX.writeFile(wb, `weak_areas_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <BarChart2 size={16} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Weak Areas</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Team accuracy by game — lowest first</p>
          </div>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium self-start"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-gold)' }}
          aria-label="Export weak areas to Excel">
          <Download size={16} /> Export Excel
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-brand-gold)' }} />
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-xl p-10 text-center"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <p style={{ color: 'var(--color-brand-muted)' }}>No session data yet. Weak areas will appear once agents complete drills.</p>
          </div>
        ) : data.map(game => {
          const pct = game.pct ?? 0
          const color = pct < 60 ? 'var(--color-brand-danger)' : pct < 75 ? 'var(--color-brand-warning)' : 'var(--color-brand-success)'
          return (
            <div key={game.name} className="rounded-xl p-4"
              style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold" style={{ color: 'var(--color-brand-text)' }}>{game.name}</p>
                <div className="text-right">
                  <p className="font-bold font-mono text-lg" style={{ color }}>{game.pct ?? '—'}%</p>
                  <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>{game.correct}/{game.total} correct</p>
                </div>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'var(--color-brand-border)' }}>
                <div className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
