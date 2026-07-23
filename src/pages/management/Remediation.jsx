import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { exportXlsx } from '../../lib/exportXlsx'
import {
  Target, Plus, X, AlertTriangle, Check, Download, Lightbulb, CheckCircle2, XCircle, Clock,
} from 'lucide-react'

const PROCEDURES = '__procedures__'   // sentinel: game_id NULL focus

// PostgREST "relation does not exist" — the migration hasn't been run yet.
const MISSING_TABLE = '42P01'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + (d.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Remediation() {
  const [rows,      setRows]      = useState([])
  const [agents,    setAgents]    = useState([])
  const [games,     setGames]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [notReady,  setNotReady]  = useState(false)
  const [banner,    setBanner]    = useState(null)
  const [busyId,    setBusyId]    = useState(null)

  // Assign modal
  const [form,       setForm]       = useState(null)   // null = closed
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [suggestion, setSuggestion] = useState(null)   // { gameId, name, acc }

  const flash = (type, text) => {
    setBanner({ type, text })
    if (type === 'success') setTimeout(() => setBanner(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [listRes, agentsRes, gamesRes] = await Promise.all([
      supabase.rpc('list_remediation'),
      supabase.rpc('get_all_agents'),
      supabase.from('games').select('id, name').order('name'),
    ])
    if (listRes.error) {
      if (listRes.error.code === MISSING_TABLE || /remediation_assignments/.test(listRes.error.message)) {
        setNotReady(true); setLoading(false); return
      }
      setError(listRes.error.message); setLoading(false); return
    }
    setRows(listRes.data ?? [])
    setAgents((agentsRes.data ?? []).filter(a => a.is_active))
    setGames(gamesRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openAssign = () => {
    setForm({ user_id: '', game: '', note: '', target_sessions: 3, due_date: '' })
    setFormError(''); setSuggestion(null)
  }

  // When the head picks an agent, fetch their weakest game (last 90 days) as a suggestion.
  const onPickAgent = async (userId) => {
    setForm(f => ({ ...f, user_id: userId }))
    setSuggestion(null)
    if (!userId) return
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('session_answers')
      .select('game_id, is_correct, sessions!inner(user_id)')
      .eq('sessions.user_id', userId)
      .gte('answered_at', cutoff)
    const byGame = {}
    for (const a of data ?? []) {
      if (!a.game_id) continue
      byGame[a.game_id] ??= { correct: 0, total: 0 }
      byGame[a.game_id].total++
      if (a.is_correct) byGame[a.game_id].correct++
    }
    const names = Object.fromEntries(games.map(g => [g.id, g.name]))
    const ranked = Object.entries(byGame)
      .map(([id, s]) => ({ gameId: id, name: names[id] ?? '—', acc: s.correct / s.total, total: s.total }))
      .filter(g => g.total >= 5)
      .sort((a, b) => a.acc - b.acc)
    if (ranked.length) setSuggestion({ gameId: ranked[0].gameId, name: ranked[0].name, acc: Math.round(ranked[0].acc * 100) })
  }

  const applySuggestion = () => {
    if (suggestion) setForm(f => ({ ...f, game: suggestion.gameId }))
  }

  const submitAssign = async () => {
    if (!form.user_id) { setFormError('Choose an agent.'); return }
    if (!form.game)    { setFormError('Choose a focus area.'); return }
    const isProc = form.game === PROCEDURES
    const gameId = isProc ? null : form.game
    const label = isProc ? 'Procedures' : (games.find(g => g.id === form.game)?.name ?? 'Focus')
    setSaving(true); setFormError('')
    const { error: err } = await supabase.rpc('assign_remediation', {
      p_user_id: form.user_id,
      p_game_id: gameId,
      p_focus_label: label,
      p_note: form.note || null,
      p_target_sessions: Number(form.target_sessions) || 3,
      p_due_date: form.due_date || null,
    })
    setSaving(false)
    if (err) { setFormError(err.message); return }
    setForm(null)
    flash('success', `Assigned ${label} to ${agents.find(a => a.id === form.user_id)?.name ?? 'agent'}.`)
    load()
  }

  const setStatus = async (row, status) => {
    setBusyId(row.id)
    const { error: err } = await supabase.rpc('set_remediation_status', { p_id: row.id, p_status: status })
    setBusyId(null)
    if (err) { flash('error', err.message); return }
    flash('success', status === 'completed' ? `Marked complete.` : `Assignment cancelled.`)
    load()
  }

  const exportExcel = () => {
    exportXlsx({
      filename: 'stellaris_remediation',
      sheet: 'Remediation',
      rows: rows.map(r => ({
        'Agent': r.name,
        'Employee ID': r.employee_id,
        'Focus': r.focus_label,
        'Progress': `${Number(r.progress)}/${r.target_sessions}`,
        'Status': r.status,
        'Due': r.due_date ? fmtDate(r.due_date) : '',
        'Assigned': fmtDate(r.created_at),
        'Note': r.note ?? '',
      })),
      cols: [{ wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 30 }],
    })
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none'
  const inputStyle = { background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }
  const card = { background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }

  const statusPill = (r) => {
    const overdue = r.status === 'assigned' && r.due_date && new Date(r.due_date) < new Date(new Date().toDateString())
    if (r.status === 'completed') return { text: 'Completed', bg: '#0f2f0f', color: 'var(--color-brand-success)' }
    if (r.status === 'cancelled') return { text: 'Cancelled', bg: '#1f0a0a', color: '#fca5a5' }
    if (overdue) return { text: 'Overdue', bg: '#2a0a0a', color: '#fca5a5' }
    return { text: 'In progress', bg: 'var(--color-brand-surface)', color: 'var(--color-brand-cyan)' }
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={card}>
            <Target size={16} style={{ color: 'var(--color-brand-cyan)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Remediation</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Assign targeted practice to agents</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          {rows.length > 0 && (
            <button onClick={exportExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ ...card, color: 'var(--color-brand-cyan)' }}>
              <Download size={16} /> Export
            </button>
          )}
          {!notReady && (
            <button onClick={openAssign}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }}>
              <Plus size={16} /> Assign
            </button>
          )}
        </div>
      </div>

      {notReady && (
        <div className="flex items-start gap-2 p-3 rounded-lg mb-4 text-sm"
          style={{ background: '#1c1a0f', border: '1px solid var(--color-brand-warning)', color: 'var(--color-brand-warning)' }}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Remediation isn’t set up yet. Run <span className="font-mono">supabase/add_remediation.sql</span> in the Supabase SQL Editor to enable it.</span>
        </div>
      )}

      {banner && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
          style={{
            background: banner.type === 'error' ? '#2a0a0a' : '#0f1f14',
            border: `1px solid ${banner.type === 'error' ? '#fca5a5' : 'var(--color-brand-success)'}`,
            color: banner.type === 'error' ? '#fca5a5' : 'var(--color-brand-success)',
          }}>
          {banner.type === 'error' ? <AlertTriangle size={15} /> : <Check size={15} />}
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="ml-auto p-1 rounded hover:opacity-60" aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm"
          style={{ background: '#1f0a0a', border: '1px solid var(--color-brand-danger)', color: '#fca5a5' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* List */}
      {!notReady && (
        <div className="rounded-xl overflow-hidden" style={card}>
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-brand-cyan)' }} />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-brand-muted)' }}>No remediation assigned yet.</p>
          ) : (
            rows.map((r, i) => {
              const pill = statusPill(r)
              const pct = Math.min(1, Number(r.progress) / r.target_sessions)
              const active = r.status === 'assigned'
              const busy = busyId === r.id
              return (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--color-brand-border)' : 'none' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-brand-text)' }}>{r.name}</p>
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)' }}>{r.employee_id}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-cyan)' }}>{r.focus_label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: pill.bg, color: pill.color }}>{pill.text}</span>
                    </div>
                    {r.note && <p className="text-xs mt-1" style={{ color: 'var(--color-brand-muted)' }}>{r.note}</p>}
                    <div className="flex items-center gap-2 mt-1.5 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                      <span>Due {fmtDate(r.due_date)}</span>
                      <span>·</span>
                      <span>Assigned {fmtDate(r.created_at)}</span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="w-full sm:w-40 shrink-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span style={{ color: 'var(--color-brand-muted)' }}>Progress</span>
                      <span className="font-mono" style={{ color: 'var(--color-brand-text)' }}>{Number(r.progress)}/{r.target_sessions}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-brand-surface)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--color-brand-success)' : 'linear-gradient(90deg, var(--color-brand-grad-a), var(--color-brand-grad-b))' }} />
                    </div>
                  </div>

                  {/* Actions */}
                  {active && (
                    <div className="flex items-center gap-2 shrink-0">
                      {busy ? (
                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-brand-cyan)' }} />
                      ) : (
                        <>
                          <button onClick={() => setStatus(r, 'completed')}
                            className="p-2 rounded-lg" title="Mark complete"
                            style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-success)' }}>
                            <CheckCircle2 size={15} />
                          </button>
                          <button onClick={() => setStatus(r, 'cancelled')}
                            className="p-2 rounded-lg" title="Cancel"
                            style={{ background: 'var(--color-brand-surface)', color: '#fca5a5' }}>
                            <XCircle size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Assign modal */}
      {form && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }} role="dialog" aria-modal="true" aria-label="Assign remediation">
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6" style={card}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg" style={{ color: 'var(--color-brand-text)' }}>Assign remediation</h2>
              <button onClick={() => setForm(null)} style={{ color: 'var(--color-brand-muted)' }} aria-label="Close"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>Agent</label>
                <select value={form.user_id} onChange={e => onPickAgent(e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="">Select an agent…</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.employee_id})</option>)}
                </select>
                {suggestion && (
                  <button onClick={applySuggestion}
                    className="flex items-center gap-1.5 mt-2 text-xs px-2 py-1 rounded-md"
                    style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-warning)' }}>
                    <Lightbulb size={13} /> Suggested: {suggestion.name} ({suggestion.acc}% accuracy) — apply
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>Focus area</label>
                <select value={form.game} onChange={e => setForm(f => ({ ...f, game: e.target.value }))} className={inputCls} style={inputStyle}>
                  <option value="">Select a focus…</option>
                  {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  <option value={PROCEDURES}>Procedures (shared)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>Target sessions</label>
                  <input type="number" min="1" max="50" value={form.target_sessions}
                    onChange={e => setForm(f => ({ ...f, target_sessions: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>Due date</label>
                  <input type="date" value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>Note (optional)</label>
                <textarea value={form.note} rows={2}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="What to focus on…" className={inputCls} style={inputStyle} />
              </div>

              <p className="flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--color-brand-muted)' }}>
                <Clock size={12} className="mt-0.5 shrink-0" />
                Auto-completes once the agent finishes {form.target_sessions || 3} qualifying drill session{Number(form.target_sessions) === 1 ? '' : 's'} in this focus. You can also mark it complete by hand.
              </p>

              {formError && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg text-xs" style={{ background: '#2a0a0a', border: '1px solid #fca5a5', color: '#fca5a5' }}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /><span>{formError}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setForm(null)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}>Cancel</button>
              <button onClick={submitAssign} disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Assigning…</> : <><Plus size={15} /> Assign</>}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Layout>
  )
}
