import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import * as XLSX from 'xlsx'
import { ClipboardList, Download, Search } from 'lucide-react'

export default function QuestionStats() {
  const [questions, setQuestions] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    supabase
      .from('questions')
      .select('id, question_text, category, difficulty, times_shown, times_correct, is_active, games(name)')
      .order('times_shown', { ascending: false })
      .limit(200)
      .then(({ data }) => { setQuestions(data ?? []); setLoading(false) })
  }, [])

  const filtered = questions.filter(q =>
    q.question_text.toLowerCase().includes(search.toLowerCase()) ||
    (q.games?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    q.category.toLowerCase().includes(search.toLowerCase())
  )

  const exportExcel = () => {
    const rows = filtered.map(q => ({
      'Game':      q.games?.name ?? 'Procedure',
      'Category':  q.category,
      'Difficulty': q.difficulty,
      'Question':  q.question_text,
      'Times Shown': q.times_shown,
      'Times Correct': q.times_correct,
      'Accuracy %': q.times_shown ? Math.round((q.times_correct / q.times_shown) * 100) : '',
      'Active': q.is_active ? 'Yes' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Question Stats')
    XLSX.writeFile(wb, `question_stats_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <ClipboardList size={16} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Question Stats</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Accuracy and exposure per question</p>
          </div>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium self-start"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-gold)' }}
          aria-label="Export question stats to Excel">
          <Download size={16} /> Export Excel
        </button>
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
        <div className="px-4 py-3 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
          <Search size={16} style={{ color: 'var(--color-brand-muted)' }} />
          <input type="text" placeholder="Search questions…" value={search}
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
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                {['Question', 'Game', 'Diff', 'Shown', 'Correct', 'Accuracy'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-widest"
                    style={{ color: 'var(--color-brand-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, i) => {
                const pct = q.times_shown ? Math.round((q.times_correct / q.times_shown) * 100) : null
                const color = pct === null ? 'var(--color-brand-muted)' :
                  pct < 60 ? 'var(--color-brand-danger)' : pct < 75 ? 'var(--color-brand-warning)' : 'var(--color-brand-success)'
                return (
                  <tr key={q.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-brand-border)' : 'none', opacity: q.is_active ? 1 : 0.5 }}>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm truncate" style={{ color: 'var(--color-brand-text)' }}>{q.question_text}</p>
                      <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>{q.category}</p>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-brand-muted)' }}>{q.games?.name ?? 'Procedure'}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-brand-muted)' }}>{q.difficulty}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--color-brand-text)' }}>{q.times_shown}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--color-brand-text)' }}>{q.times_correct}</td>
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color }}>
                      {pct !== null ? `${pct}%` : '—'}
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
