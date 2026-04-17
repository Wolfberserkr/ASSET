import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import {
  CheckCircle, XCircle, Trophy, Clock, RotateCcw,
  ChevronDown, ChevronUp, AlertTriangle, Home,
  TrendingUp, TrendingDown, Target, Zap, Award,
  BookOpen, BarChart2,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function multiplierLabel(totalSecs) {
  if (totalSecs <= 5 * 60)   return { label: '×1.5', color: 'var(--color-brand-success)' }
  if (totalSecs <= 7.5 * 60) return { label: '×1.25', color: 'var(--color-brand-warning)' }
  return                            { label: '×1.0',  color: 'var(--color-brand-muted)' }
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function gradeInfo(accuracy) {
  if (accuracy === 100) return { label: 'PERFECT',          color: 'var(--color-brand-gold)',    icon: Trophy }
  if (accuracy >= 90)   return { label: 'EXCELLENT',        color: 'var(--color-brand-success)', icon: Award }
  if (accuracy >= 70)   return { label: 'GOOD',             color: 'var(--color-brand-blue)',    icon: TrendingUp }
  if (accuracy >= 50)   return { label: 'KEEP PRACTICING',  color: 'var(--color-brand-warning)', icon: Target }
  return                       { label: 'NEEDS WORK',       color: 'var(--color-brand-danger)',  icon: TrendingDown }
}

function difficultyLabel(d) {
  if (d === 1) return { label: 'Easy',   color: 'var(--color-brand-success)' }
  if (d === 2) return { label: 'Medium', color: 'var(--color-brand-warning)' }
  return               { label: 'Hard',  color: 'var(--color-brand-danger)'  }
}

function AccuracyBar({ pct, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--color-brand-border)' }}>
        <div
          className="h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono w-9 text-right" style={{ color }}>
        {pct}%
      </span>
    </div>
  )
}

// ─── Missed question accordion ────────────────────────────────────────────────

function MissedQuestion({ answer, index, gameName }) {
  const [open, setOpen] = useState(false)
  const q = answer.question
  const isRoulette = gameName?.toLowerCase().includes('roulette') && q?.type === 'payout'

  // For Roulette: bet_amount_shown stores correctPayout (set in DrillSession).
  // For other payout drills: bet_amount_shown stores the total bet shown to the agent.
  const correctAnswerDisplay = (() => {
    if (isRoulette) {
      const amt = answer.bet_amount_shown
      return amt != null
        ? `$${Number(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '—'
    }
    if (q?.type === 'payout' && answer.bet_amount_shown) {
      return `$${(parseFloat(q.correct_answer) * answer.bet_amount_shown).toFixed(2)}`
    }
    return q?.correct_answer ?? '—'
  })()

  const userAnswerDisplay = (() => {
    const raw = answer.user_answer || '—'
    if ((isRoulette || q?.type === 'payout') && raw !== '—') {
      const num = parseFloat(raw.replace(/[$,\s]/g, ''))
      if (!isNaN(num)) {
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
    }
    return raw
  })()

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-brand-border)', background: 'var(--color-brand-card)' }}
    >
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <XCircle size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--color-brand-danger)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--color-brand-text)' }}>
            {isRoulette ? 'Roulette — Payout Drill' : (q?.question_text ?? '—')}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {q?.category && (
              <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                {q.category}
              </span>
            )}
            {gameName && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'var(--color-brand-border)', color: 'var(--color-brand-muted)' }}
              >
                {gameName}
              </span>
            )}
            {q?.difficulty && (
              <span
                className="text-xs font-mono"
                style={{ color: difficultyLabel(q.difficulty).color }}
              >
                {difficultyLabel(q.difficulty).label}
              </span>
            )}
          </div>
        </div>
        {open
          ? <ChevronUp size={16} className="shrink-0 mt-1" style={{ color: 'var(--color-brand-muted)' }} />
          : <ChevronDown size={16} className="shrink-0 mt-1" style={{ color: 'var(--color-brand-muted)' }} />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--color-brand-border)' }}>
          <div className="mt-3 p-3 rounded-lg" style={{ background: '#1f0a0a' }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--color-brand-danger)' }}>
              Your answer
            </p>
            <p className="text-sm font-mono" style={{ color: '#fca5a5' }}>
              {userAnswerDisplay}
            </p>
          </div>

          <div className="p-3 rounded-lg" style={{ background: '#0a1f0a' }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--color-brand-success)' }}>
              Correct answer
            </p>
            <p className="text-sm font-mono" style={{ color: '#86efac' }}>
              {correctAnswerDisplay}
            </p>
          </div>

          {q?.explanation && (
            <div className="p-3 rounded-lg" style={{ background: 'var(--color-brand-bg)' }}>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--color-brand-muted)' }}>
                Explanation
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-brand-text)' }}>
                {q.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Results() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()

  const [session,  setSession]  = useState(null)
  const [answers,  setAnswers]  = useState([])
  const [gameMap,  setGameMap]  = useState({})   // { [game_id]: name }
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!sessionId) return

    async function load() {
      try {
        const { data: sess, error: sessErr } = await supabase
          .from('sessions')
          .select('id, score, status, total_time_seconds, total_questions, completed_at')
          .eq('id', sessionId)
          .single()

        if (sessErr) throw sessErr

        const { data: ans, error: ansErr } = await supabase
          .from('session_answers')
          .select(`
            id,
            user_answer,
            is_correct,
            bet_amount_shown,
            question:questions (
              id,
              question_text,
              correct_answer,
              explanation,
              category,
              type,
              difficulty,
              game_id
            )
          `)
          .eq('session_id', sessionId)
          .order('answered_at', { ascending: true })

        if (ansErr) throw ansErr

        // Fetch game names — derive game_id from the joined question, not from session_answers directly
        const gameIds = [...new Set((ans ?? [])
          .map(a => a.question?.game_id)
          .filter(Boolean))]

        let gmap = {}
        if (gameIds.length > 0) {
          const { data: games } = await supabase
            .from('games')
            .select('id, name')
            .in('id', gameIds)
          if (games) games.forEach(g => { gmap[g.id] = g.name })
        }

        setSession(sess)
        setAnswers(ans ?? [])
        setGameMap(gmap)
      } catch (err) {
        console.error('Results load error:', err)
        setError('Could not load session results.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [sessionId])

  // ── Loading ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
               style={{ borderColor: 'var(--color-brand-gold)', borderTopColor: 'transparent' }} />
        </div>
      </Layout>
    )
  }

  if (error || !session) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertTriangle size={36} style={{ color: 'var(--color-brand-danger)' }} />
          <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
            {error || 'Session not found.'}
          </p>
          <button onClick={() => navigate('/dashboard')}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--color-brand-card)', color: 'var(--color-brand-text)', border: '1px solid var(--color-brand-border)' }}>
            Back to Dashboard
          </button>
        </div>
      </Layout>
    )
  }

  // ── Compute display values ──────────────────────────────────────

  const totalQ        = session.total_questions ?? 10
  const correctCount  = answers.filter(a => a.is_correct).length
  const wrongCount    = totalQ - correctCount
  const accuracy      = Math.round((correctCount / totalQ) * 100)
  const score         = session.score ?? 0
  const maxScore      = 150
  const elapsed       = session.total_time_seconds ?? 0
  const multInfo      = multiplierLabel(elapsed)
  const missedAnswers = answers.filter(a => !a.is_correct)
  const grade         = gradeInfo(accuracy)
  const GradeIcon     = grade.icon

  const scoreColor = accuracy >= 80
    ? 'var(--color-brand-success)'
    : accuracy >= 60
      ? 'var(--color-brand-warning)'
      : 'var(--color-brand-danger)'

  // ── Per-game breakdown ──────────────────────────────────────────
  const gameBreakdown = (() => {
    const map = {}
    answers.forEach(a => {
      const gid  = a.question?.game_id ?? null
      const key  = gid ?? 'procedures'
      const name = gid ? (gameMap[gid] ?? 'Unknown') : 'Procedures'
      if (!map[key]) map[key] = { name, correct: 0, total: 0 }
      map[key].total++
      if (a.is_correct) map[key].correct++
    })
    return Object.values(map)
      .map(g => ({ ...g, pct: Math.round((g.correct / g.total) * 100) }))
      .sort((a, b) => a.pct - b.pct)  // weakest first
  })()

  // ── Category breakdown (missed only) ───────────────────────────
  const categoryMisses = (() => {
    const map = {}
    missedAnswers.forEach(a => {
      const cat = a.question?.category ?? 'Uncategorized'
      if (!map[cat]) map[cat] = 0
      map[cat]++
    })
    return Object.entries(map)
      .map(([cat, count]) => ({ cat, count }))
      .sort((a, b) => b.count - a.count)
  })()

  // ── Difficulty breakdown ────────────────────────────────────────
  const diffBreakdown = (() => {
    const map = { 1: { correct: 0, total: 0 }, 2: { correct: 0, total: 0 }, 3: { correct: 0, total: 0 } }
    answers.forEach(a => {
      const d = a.question?.difficulty ?? 1
      if (!map[d]) map[d] = { correct: 0, total: 0 }
      map[d].total++
      if (a.is_correct) map[d].correct++
    })
    return [1, 2, 3]
      .filter(d => map[d].total > 0)
      .map(d => ({
        d,
        ...difficultyLabel(d),
        correct: map[d].correct,
        total: map[d].total,
        pct: Math.round((map[d].correct / map[d].total) * 100),
      }))
  })()

  return (
    <Layout>

      {/* ── Score hero ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 mb-4 text-center"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
      >
        {/* Grade badge */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <GradeIcon size={20} style={{ color: grade.color }} />
          <span
            className="text-xs font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full"
            style={{ color: grade.color, border: `1px solid ${grade.color}` }}
          >
            {grade.label}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-end justify-center gap-1.5 mb-1">
          <span className="text-5xl font-bold font-mono" style={{ color: scoreColor }}>
            {score}
          </span>
          <span className="text-xl mb-1.5 font-mono" style={{ color: 'var(--color-brand-muted)' }}>
            / {maxScore}
          </span>
        </div>

        {/* Multiplier badge */}
        <span
          className="inline-block text-xs px-2.5 py-1 rounded-full font-mono font-semibold mb-5"
          style={{ color: multInfo.color, border: `1px solid ${multInfo.color}` }}
        >
          Time multiplier {multInfo.label}
        </span>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="flex flex-col items-center">
            <CheckCircle size={20} className="mb-1" style={{ color: 'var(--color-brand-success)' }} />
            <span className="text-xl font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>
              {correctCount}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Correct</span>
          </div>
          <div className="flex flex-col items-center">
            <XCircle size={20} className="mb-1" style={{ color: 'var(--color-brand-danger)' }} />
            <span className="text-xl font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>
              {wrongCount}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Missed</span>
          </div>
          <div className="flex flex-col items-center">
            <Clock size={20} className="mb-1" style={{ color: 'var(--color-brand-muted)' }} />
            <span className="text-xl font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>
              {fmtTime(elapsed)}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Time</span>
          </div>
        </div>

        {/* Accuracy bar */}
        <div className="mt-5">
          <div className="h-2 rounded-full" style={{ background: 'var(--color-brand-border)' }}>
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{ width: `${accuracy}%`, background: scoreColor }}
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--color-brand-muted)' }}>
            {accuracy}% accuracy
          </p>
        </div>
      </div>

      {/* ── Question sequence strip ─────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-4 mb-4"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
      >
        <p className="text-xs uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--color-brand-muted)' }}>
          <Zap size={13} /> Question Sequence
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Array.from({ length: totalQ }, (_, i) => {
            const a = answers[i]
            if (!a) {
              // Unanswered slot — shown as neutral grey
              return (
                <div
                  key={i}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold"
                  style={{
                    background: 'var(--color-brand-border)',
                    color: 'var(--color-brand-muted)',
                    border: '1px solid var(--color-brand-border)',
                  }}
                  title={`Q${i + 1} — not answered`}
                >
                  {i + 1}
                </div>
              )
            }
            return (
              <div
                key={a.id}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold"
                style={{
                  background: a.is_correct ? '#0a2e1a' : '#2e0a0a',
                  color: a.is_correct ? 'var(--color-brand-success)' : 'var(--color-brand-danger)',
                  border: `1px solid ${a.is_correct ? 'var(--color-brand-success)' : 'var(--color-brand-danger)'}`,
                }}
                title={a.question?.question_text ?? `Q${i + 1}`}
              >
                {i + 1}
              </div>
            )
          })}
          {answers.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>No answers recorded.</span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-brand-success)' }} />
            <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Correct</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-brand-danger)' }} />
            <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Missed</span>
          </div>
          {answers.length < totalQ && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-brand-border)' }} />
              <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Not answered</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Per-game breakdown ──────────────────────────────────── */}
      {gameBreakdown.length > 0 && (
        <div
          className="rounded-2xl px-5 py-4 mb-4"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
        >
          <p className="text-xs uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--color-brand-muted)' }}>
            <BarChart2 size={13} /> Accuracy by Game
          </p>
          <div className="flex flex-col gap-3">
            {gameBreakdown.map(g => {
              const barColor = g.pct >= 80
                ? 'var(--color-brand-success)'
                : g.pct >= 60
                  ? 'var(--color-brand-warning)'
                  : 'var(--color-brand-danger)'
              return (
                <div key={g.name}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm" style={{ color: 'var(--color-brand-text)' }}>{g.name}</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                      {g.correct}/{g.total}
                    </span>
                  </div>
                  <AccuracyBar pct={g.pct} color={barColor} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Difficulty breakdown ────────────────────────────────── */}
      {diffBreakdown.length > 0 && (
        <div
          className="rounded-2xl px-5 py-4 mb-4"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
        >
          <p className="text-xs uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--color-brand-muted)' }}>
            <Target size={13} /> Accuracy by Difficulty
          </p>
          <div className="flex flex-col gap-3">
            {diffBreakdown.map(d => (
              <div key={d.d}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium" style={{ color: d.color }}>{d.label}</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                    {d.correct}/{d.total}
                  </span>
                </div>
                <AccuracyBar pct={d.pct} color={d.color} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Areas for improvement ───────────────────────────────── */}
      {categoryMisses.length > 0 && (
        <div
          className="rounded-2xl px-5 py-4 mb-4"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
        >
          <p className="text-xs uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--color-brand-muted)' }}>
            <BookOpen size={13} /> Areas for Improvement
          </p>
          <div className="flex flex-col gap-2">
            {categoryMisses.map(({ cat, count }) => (
              <div
                key={cat}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: count >= 3
                        ? 'var(--color-brand-danger)'
                        : count === 2
                          ? 'var(--color-brand-warning)'
                          : 'var(--color-brand-muted)',
                    }}
                  />
                  <span className="text-sm" style={{ color: 'var(--color-brand-text)' }}>{cat}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                    {count} missed
                  </span>
                  {count >= 3 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ background: '#2e0a0a', color: 'var(--color-brand-danger)' }}
                    >
                      Focus area
                    </span>
                  )}
                  {count === 2 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ background: '#2e1a00', color: 'var(--color-brand-warning)' }}
                    >
                      Review
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Weakest game call-out */}
          {gameBreakdown[0] && gameBreakdown[0].pct < 80 && (
            <div
              className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg"
              style={{ background: '#0a1225', border: '1px solid var(--color-brand-blue)' }}
            >
              <TrendingUp size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--color-brand-blue)' }} />
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-brand-text)' }}>
                Your weakest game this session was{' '}
                <span className="font-semibold" style={{ color: 'var(--color-brand-blue)' }}>
                  {gameBreakdown[0].name}
                </span>{' '}
                ({gameBreakdown[0].pct}% accuracy). Use Practice mode to drill that game specifically.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Perfect score banner ────────────────────────────────── */}
      {wrongCount === 0 && answers.length > 0 && (
        <div
          className="rounded-2xl p-6 text-center mb-4"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-success)' }}
        >
          <CheckCircle size={32} className="mx-auto mb-2" style={{ color: 'var(--color-brand-success)' }} />
          <p className="font-semibold" style={{ color: 'var(--color-brand-text)' }}>Perfect score!</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-brand-muted)' }}>
            Every question answered correctly.
          </p>
        </div>
      )}

      {/* ── Missed questions review ─────────────────────────────── */}
      {missedAnswers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-brand-text)' }}>
            <XCircle size={15} style={{ color: 'var(--color-brand-danger)' }} />
            Review Missed Questions ({missedAnswers.length})
          </h2>
          <div className="flex flex-col gap-3">
            {missedAnswers.map((a, i) => {
              const gid      = a.question?.game_id ?? null
              const gameName = gid ? (gameMap[gid] ?? null) : 'Procedures'
              return (
                <MissedQuestion key={a.id} answer={a} index={i} gameName={gameName} />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-2">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--color-brand-card)', color: 'var(--color-brand-text)', border: '1px solid var(--color-brand-border)' }}
        >
          <Home size={16} /> Dashboard
        </button>
        <button
          onClick={() => navigate('/drill')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--color-brand-gold)', color: '#0b0f1a' }}
        >
          <RotateCcw size={16} /> Drill Again
        </button>
      </div>

    </Layout>
  )
}
