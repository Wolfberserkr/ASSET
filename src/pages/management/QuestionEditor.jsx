import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { BookOpen, Plus, AlertTriangle, Check, X, Edit2 } from 'lucide-react'

const CATEGORIES = [
  'procedure', 'blackjack', 'roulette', 'three_card_poker', 'let_it_ride', 'ultimate_texas_holdem',
]

const BLANK = {
  game_id: '', type: 'multiple_choice', question_text: '', options: ['', '', '', ''],
  correct_answer: '', explanation: '', category: '', is_procedure: false,
  difficulty: 1, points: 10, is_active: true,
}

export default function QuestionEditor() {
  const [games,     setGames]     = useState([])
  const [questions, setQuestions] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [form,      setForm]      = useState(null)  // null = hidden; object = editing/creating
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [filterGame, setFilterGame] = useState('all')

  useEffect(() => {
    Promise.all([
      supabase.from('games').select('*').eq('is_active', true),
      supabase.from('questions').select('*, games(name)').order('created_at', { ascending: false }).limit(200),
    ]).then(([gamesRes, qRes]) => {
      setGames(gamesRes.data ?? [])
      setQuestions(qRes.data ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = filterGame === 'all' ? questions :
    filterGame === 'procedure' ? questions.filter(q => q.is_procedure) :
    questions.filter(q => q.game_id === filterGame)

  const saveQuestion = async () => {
    if (!form.question_text.trim() || !form.correct_answer.trim() || !form.category) {
      setError('Question text, correct answer, and category are required.')
      return
    }
    setSaving(true); setError('')
    const payload = {
      ...form,
      game_id: form.is_procedure ? null : (form.game_id || null),
      options: form.type === 'multiple_choice' ? form.options.filter(o => o.trim()) : null,
    }
    let result
    if (form.id) {
      result = await supabase.from('questions').update(payload).eq('id', form.id).select().single()
    } else {
      result = await supabase.from('questions').insert(payload).select().single()
    }

    if (result.error) { setError(result.error.message); setSaving(false); return }

    // Refresh list
    const { data } = await supabase.from('questions').select('*, games(name)').order('created_at', { ascending: false }).limit(200)
    setQuestions(data ?? [])
    setForm(null)
    setSaving(false)
  }

  const toggleActive = async (q) => {
    await supabase.from('questions').update({ is_active: !q.is_active }).eq('id', q.id)
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_active: !x.is_active } : x))
  }

  const inputCls = "w-full px-3 py-2 rounded-lg text-sm outline-none"
  const inputStyle = { background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }

  // Count active questions per game for the warning
  const activeCountByGame = {}
  games.forEach(g => {
    activeCountByGame[g.id] = questions.filter(q => q.game_id === g.id && q.is_active).length
  })

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <BookOpen size={16} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Question Editor</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Create and manage drill questions</p>
          </div>
        </div>
        <button onClick={() => { setForm({ ...BLANK }); setError('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold self-start"
          style={{ background: 'var(--color-brand-gold)', color: '#0b0f1a' }}>
          <Plus size={16} /> New Question
        </button>
      </div>

      {/* Low pool warnings */}
      {games.filter(g => (activeCountByGame[g.id] ?? 0) < 30).map(g => (
        <div key={g.id} className="flex items-center gap-2 p-3 rounded-lg mb-3 text-sm"
          style={{ background: '#1c1a0f', border: '1px solid var(--color-brand-warning)', color: 'var(--color-brand-warning)' }}>
          <AlertTriangle size={15} />
          <span><strong>{g.name}</strong> has only {activeCountByGame[g.id] ?? 0} active questions (minimum 30 required).</span>
        </div>
      ))}

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[{ label: 'All', value: 'all' }, { label: 'Procedure', value: 'procedure' },
          ...games.map(g => ({ label: g.name, value: g.id }))].map(opt => (
          <button key={opt.value} onClick={() => setFilterGame(opt.value)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: filterGame === opt.value ? 'var(--color-brand-gold)' : 'var(--color-brand-card)',
              color: filterGame === opt.value ? '#0b0f1a' : 'var(--color-brand-muted)',
              border: '1px solid var(--color-brand-border)',
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Question list */}
      <div className="rounded-xl overflow-hidden mb-6"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-brand-gold)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>
            No questions in this filter.
          </p>
        ) : (
          filtered.map((q, i) => (
            <div key={q.id} className="flex items-start gap-3 px-4 py-3"
              style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-brand-border)' : 'none',
                opacity: q.is_active ? 1 : 0.5 }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-brand-text)' }}>
                  {q.question_text}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)' }}>
                    {q.games?.name ?? 'Procedure'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Diff {q.difficulty}</span>
                  <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>{q.type}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleActive(q)}
                  className="p-2 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
                  aria-label={q.is_active ? 'Deactivate question' : 'Activate question'}
                  style={{ background: 'var(--color-brand-surface)', color: q.is_active ? 'var(--color-brand-success)' : 'var(--color-brand-muted)' }}>
                  {q.is_active ? <Check size={16} /> : <X size={16} />}
                </button>
                <button onClick={() => { setForm({ ...q, options: q.options ?? ['', '', '', ''] }); setError('') }}
                  className="p-2 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
                  aria-label="Edit question"
                  style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)' }}>
                  <Edit2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          role="dialog" aria-modal="true" aria-label={form.id ? 'Edit question' : 'New question'}>
          <div className="w-full sm:max-w-xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg" style={{ color: 'var(--color-brand-text)' }}>
                {form.id ? 'Edit Question' : 'New Question'}
              </h2>
              <button onClick={() => setForm(null)} style={{ color: 'var(--color-brand-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Is procedure */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_procedure}
                  onChange={e => setForm(f => ({ ...f, is_procedure: e.target.checked, game_id: e.target.checked ? '' : f.game_id }))}
                  className="accent-[var(--color-brand-gold)]" />
                <span className="text-sm" style={{ color: 'var(--color-brand-text)' }}>Shared procedure question (no specific game)</span>
              </label>

              {/* Game */}
              {!form.is_procedure && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Game</label>
                  <select value={form.game_id} onChange={e => setForm(f => ({ ...f, game_id: e.target.value }))}
                    className={inputCls} style={inputStyle}>
                    <option value="">— Select game —</option>
                    {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}

              {/* Type */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className={inputCls} style={inputStyle}>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="payout">Payout Drill</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Category</label>
                <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. procedure, blackjack, game_protection"
                  className={inputCls} style={inputStyle} list="categories" />
                <datalist id="categories">
                  {CATEGORIES.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              {/* Question text */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Question</label>
                <textarea rows={3} value={form.question_text}
                  onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))}
                  className={inputCls} style={inputStyle} />
              </div>

              {/* Options (MC only) */}
              {form.type === 'multiple_choice' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Answer Options</label>
                  <div className="space-y-2">
                    {(form.options || ['', '', '', '']).map((opt, idx) => (
                      <input key={idx} type="text" value={opt}
                        onChange={e => setForm(f => {
                          const opts = [...(f.options ?? ['', '', '', ''])]
                          opts[idx] = e.target.value
                          return { ...f, options: opts }
                        })}
                        placeholder={`Option ${idx + 1}`}
                        className={inputCls} style={inputStyle} />
                    ))}
                  </div>
                </div>
              )}

              {/* Correct answer */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>
                  Correct Answer {form.type === 'multiple_choice' ? '(must match one option exactly)' : '(dollar amount)'}
                </label>
                <input type="text" value={form.correct_answer}
                  onChange={e => setForm(f => ({ ...f, correct_answer: e.target.value }))}
                  className={inputCls} style={inputStyle} />
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Explanation (shown after wrong answer)</label>
                <textarea rows={2} value={form.explanation ?? ''}
                  onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
                  className={inputCls} style={inputStyle} />
              </div>

              {/* Difficulty + Points */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Difficulty</label>
                  <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: Number(e.target.value) }))}
                    className={inputCls} style={inputStyle}>
                    <option value={1}>1 — Easy</option>
                    <option value={2}>2 — Medium</option>
                    <option value={3}>3 — Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Points</label>
                  <input type="number" value={form.points} min={1} max={50}
                    onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))}
                    className={inputCls} style={inputStyle} />
                </div>
              </div>

              {error && (
                <p className="text-sm" style={{ color: 'var(--color-brand-danger)' }}>{error}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={saveQuestion} disabled={saving}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                  style={{ background: 'var(--color-brand-gold)', color: '#0b0f1a' }}>
                  {saving ? 'Saving…' : form.id ? 'Update Question' : 'Create Question'}
                </button>
                <button onClick={() => setForm(null)}
                  className="px-4 py-2.5 rounded-lg text-sm"
                  style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
