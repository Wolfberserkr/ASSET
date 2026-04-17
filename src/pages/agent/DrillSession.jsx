import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { buildSession, randomizeBetAmount } from '../../lib/questionRandomizer'
import { generateRouletteScenario } from '../../lib/rouletteScenario'
import { useSessionTimer } from '../../hooks/useSessionTimer'
import { useAdaptiveDifficulty } from '../../hooks/useAdaptiveDifficulty'
import PayoutTable from '../../components/tables/PayoutTable'
import {
  Clock, AlertTriangle, ChevronRight, DollarSign, X,
} from 'lucide-react'

// ─── Roulette detection ───────────────────────────────────────────────────────

function isRouletteQuestion(q) {
  return (q?.games?.name ?? '').toLowerCase().includes('roulette')
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

const POINTS_PER_CORRECT = 10

function computeScore(correctCount, elapsedSeconds) {
  const base = correctCount * POINTS_PER_CORRECT
  let multiplier = 1.0
  if (elapsedSeconds <= 5 * 60)        multiplier = 1.5
  else if (elapsedSeconds <= 7.5 * 60) multiplier = 1.25
  return Math.round(base * multiplier)
}

// ─── Answer validation ────────────────────────────────────────────────────────
//
// For payout questions, `correct_answer` stores the PAYOUT RATIO (e.g. "1.5"
// for a 3:2 Blackjack). Expected = betAmount × ratio.
//
// For Roulette, the expected answer comes from the generated scenario's
// correctPayout (sum of winning bet payouts). The DB ratio is ignored.

function validatePayoutAnswer(userAnswer, payoutRatio, betAmount) {
  const clean = (s) => parseFloat(String(s).replace(/[$,\s]/g, ''))
  const ua    = clean(userAnswer)
  const ratio = clean(String(payoutRatio))
  if (isNaN(ua) || isNaN(ratio) || !betAmount) return false
  const expected = Math.round(betAmount * ratio * 100) / 100
  return Math.abs(ua - expected) < 0.02
}

function validateAnswer(question, userAnswer, betAmount = 0, rouletteScenario = null) {
  if (question.type === 'payout') {
    if (rouletteScenario) {
      const ua = parseFloat(String(userAnswer).replace(/[$,\s]/g, ''))
      if (isNaN(ua)) return false
      return Math.abs(ua - rouletteScenario.correctPayout) < 0.02
    }
    return validatePayoutAnswer(userAnswer, question.correct_answer, betAmount)
  }
  return String(userAnswer).trim() === String(question.correct_answer).trim()
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────

const DIFF_LABEL = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }
const DIFF_COLOR = {
  1: 'var(--color-brand-success)',
  2: 'var(--color-brand-warning)',
  3: 'var(--color-brand-danger)',
}

// ─── Odds injection ───────────────────────────────────────────────────────────
// Converts a stored payout ratio (e.g. "3", "1.5") into a readable odds string.

function formatOdds(ratioStr) {
  const r = parseFloat(ratioStr)
  if (isNaN(r)) return ''
  if (r === 1.5)  return '3:2'
  if (r === 0.5)  return '1:2'
  if (Number.isInteger(r)) return `${r}:1`
  // Generic: express as N:1 with one decimal place
  return `${r}:1`
}

// Ordered longest-first so "Straight Flush" matches before "Straight" etc.
const HAND_NAMES = [
  'Mini Royal',
  'Royal Flush',
  'Straight Flush',
  'Four of a Kind',
  'Full House',
  'Three of a Kind',
  'Two Pair',
  'Pair of Tens or better',
  'Pair Plus',          // skip — this is the bet name, not a hand
  'Flush',
  'Straight',
  'Pair',
]

// Injects "(X:1)" after the first recognised hand name in the question text.
// "Pair Plus" is intentionally excluded so we never annotate the bet name.
const SKIP_HANDS = new Set(['Pair Plus'])

function injectOddsIntoQuestion(text, ratioStr) {
  if (!text || !ratioStr) return text
  const odds = formatOdds(ratioStr)
  if (!odds) return text
  for (const hand of HAND_NAMES) {
    if (SKIP_HANDS.has(hand)) continue
    const idx = text.indexOf(hand)
    if (idx !== -1) {
      return text.slice(0, idx + hand.length) + ` (${odds})` + text.slice(idx + hand.length)
    }
  }
  return text
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DrillSession() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // ── State ──────────────────────────────────────────────────────
  const [status,          setStatus]          = useState('loading')  // loading|active|finalizing|error
  const [questions,       setQuestions]       = useState([])
  const [currentIdx,      setCurrentIdx]      = useState(0)
  const [answers,         setAnswers]         = useState([])
  const [betContext,      setBetContext]      = useState(null)  // { chips, totalBet } for TCP/LIR/UTH
  const [rouletteScenario, setRouletteScenario] = useState(null) // generated Roulette scenario
  const [inputValue,      setInputValue]      = useState('')
  const [inputError,      setInputError]      = useState('')
  const [loadError,       setLoadError]       = useState('')
  const [focusedIdx,      setFocusedIdx]      = useState(0)   // keyboard nav for multiple choice
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const sessionIdRef  = useRef(null)
  const finalizingRef = useRef(false)
  const answersRef    = useRef([])   // live ref so finalizeSession always sees latest

  // ── Hooks ──────────────────────────────────────────────────────
  const {
    getDifficulty,
    recordAnswer: recordDifficulty,
    difficultyMap,
    loading: diffLoading,
  } = useAdaptiveDifficulty(user?.id)

  // Keep answersRef in sync
  useEffect(() => { answersRef.current = answers }, [answers])

  // Finalize is defined before useSessionTimer so it can be passed as onExpire
  const finalizeSession = useCallback(async (outcome, finalAnswers) => {
    if (finalizingRef.current) return
    finalizingRef.current = true
    setStatus('finalizing')

    const sessionId      = sessionIdRef.current
    const resolvedAnswers = finalAnswers ?? answersRef.current
    const correctCount   = resolvedAnswers.filter(a => a.is_correct).length

    // elapsedSeconds is captured via closure from the timer — read from DOM backup
    const elapsedEl = document.getElementById('__elapsed__')
    const elapsed   = elapsedEl ? parseInt(elapsedEl.dataset.val, 10) : 0

    const score = outcome === 'completed'
      ? computeScore(correctCount, elapsed)
      : 0

    try {
      if (resolvedAnswers.length > 0) {
        const { error: ansErr } = await supabase
          .from('session_answers')
          .insert(resolvedAnswers)
        if (ansErr) console.error('session_answers insert error:', ansErr)
      }

      const { error: sessErr } = await supabase
        .from('sessions')
        .update({
          status:             outcome,
          score,
          completed_at:       outcome === 'completed' ? new Date().toISOString() : null,
          total_time_seconds: elapsed,
        })
        .eq('id', sessionId)
      if (sessErr) console.error('sessions update error:', sessErr)

      // Update question stats (fire-and-forget)
      for (const a of resolvedAnswers) {
        supabase.rpc('update_question_stats', {
          p_question_id: a.question_id,
          p_is_correct:  a.is_correct,
        }).catch(() => {})
      }

      supabase.rpc('log_audit_event', {
        p_action:  outcome === 'completed' ? 'SESSION_COMPLETED' : 'SESSION_ABANDONED',
        p_details: { session_id: sessionId, score, correct: correctCount },
      }).catch(() => {})

    } catch (err) {
      // Log the error but don't bail — still navigate so the agent sees their results
      console.error('finalizeSession error:', err)
    }

    // Navigation is intentionally outside try/catch: completed sessions ALWAYS
    // go to the results screen regardless of any Supabase errors above.
    if (outcome === 'completed') {
      navigate(`/results/${sessionId}`)
    } else {
      navigate('/dashboard?reason=expired')
    }
  }, [navigate])

  const handleExpire = useCallback(() => {
    finalizeSession('abandoned')
  }, [finalizeSession])

  const {
    elapsedSeconds,
    remainingDisplay,
    remainingSeconds,
    start: startTimer,
  } = useSessionTimer({ onExpire: handleExpire })

  // ── Initialize session ─────────────────────────────────────────
  useEffect(() => {
    if (!user || diffLoading) return

    let cancelled = false

    async function init() {
      try {
        const drawn = await buildSession(user.id, difficultyMap)
        if (cancelled) return

        const { data: sessionRow, error: sessionErr } = await supabase
          .from('sessions')
          .insert({
            user_id:         user.id,
            status:          'in_progress',
            total_questions: 10,
            user_agent:      navigator.userAgent,
          })
          .select('id')
          .single()

        if (sessionErr) throw sessionErr
        if (cancelled)  return

        sessionIdRef.current = sessionRow.id
        const firstQ      = drawn[0]
        const firstIsRoul = isRouletteQuestion(firstQ)
        const bet         = firstQ?.type === 'payout' && !firstIsRoul
          ? randomizeBetAmount(firstQ) : null
        const scenario    = firstIsRoul ? generateRouletteScenario() : null
        setQuestions(drawn)
        setBetContext(bet)
        setRouletteScenario(scenario)
        setStatus('active')
        startTimer()
      } catch (err) {
        console.error('DrillSession init:', err)
        if (!cancelled) setLoadError(err.message ?? 'Failed to start session.')
      }
    }

    init()
    return () => { cancelled = true }
  }, [user, diffLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit answer ──────────────────────────────────────────────
  const submitAnswer = useCallback((userAnswer) => {
    if (status !== 'active') return

    const q         = questions[currentIdx]
    const isCorrect = validateAnswer(q, userAnswer, betContext?.totalBet ?? 0, rouletteScenario)

    if (q.game_id) recordDifficulty(q.game_id, isCorrect)

    const record = {
      session_id:       sessionIdRef.current,
      question_id:      q.id,
      game_id:          q.game_id ?? null,
      user_answer:      String(userAnswer),
      is_correct:       isCorrect,
      bet_amount_shown: rouletteScenario ? rouletteScenario.correctPayout : (betContext?.totalBet ?? null),
      answered_at:      new Date().toISOString(),
    }

    const newAnswers = [...answersRef.current, record]
    setAnswers(newAnswers)
    setInputValue('')
    setInputError('')

    if (currentIdx + 1 < questions.length) {
      const nextQ      = questions[currentIdx + 1]
      const nextIsRoul = isRouletteQuestion(nextQ)
      setBetContext(nextQ.type === 'payout' && !nextIsRoul ? randomizeBetAmount(nextQ) : null)
      setRouletteScenario(nextIsRoul ? generateRouletteScenario() : null)
      setCurrentIdx(i => i + 1)
    } else {
      finalizeSession('completed', newAnswers)
    }
  }, [status, questions, currentIdx, betContext, rouletteScenario, recordDifficulty, finalizeSession])

  // ── Abandon on unload ──────────────────────────────────────────
  useEffect(() => {
    const onUnload = () => {
      if (status === 'active' && sessionIdRef.current) {
        navigator.sendBeacon(`/api/noop`) // placeholder — actual RPC not available as beacon
        supabase.from('sessions')
          .update({ status: 'abandoned', score: 0 })
          .eq('id', sessionIdRef.current)
          .then(() => {}).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [status])

  // ── Keyboard nav for multiple choice ──────────────────────────
  // Enter submits payout forms natively (via <form>).
  // For multiple choice, arrow keys cycle options; Enter selects.
  useEffect(() => {
    if (status !== 'active') return
    const q = questions[currentIdx]
    if (!q || q.type === 'payout') return          // payout handled by <form>
    const opts = q.options
    if (!Array.isArray(opts) || opts.length === 0) return

    const onKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIdx(i => (i + 1) % opts.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIdx(i => (i - 1 + opts.length) % opts.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        submitAnswer(opts[focusedIdx])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, questions, currentIdx, focusedIdx, submitAnswer])

  // Reset focused index whenever the question changes
  useEffect(() => { setFocusedIdx(0) }, [currentIdx])

  // ── Handle payout submit ───────────────────────────────────────
  const handlePayoutSubmit = (e) => {
    e.preventDefault()
    const raw = inputValue.trim()
    if (!raw) { setInputError('Enter a dollar amount.'); return }
    const num = parseFloat(raw.replace(/[$,]/g, ''))
    if (isNaN(num) || num < 0) { setInputError('Enter a valid dollar amount.'); return }
    submitAnswer(raw)
  }

  // ─── Loading / error states ────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4"
           style={{ background: 'var(--color-brand-bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
             style={{ borderColor: 'var(--color-brand-gold)', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Preparing your session…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
           style={{ background: 'var(--color-brand-bg)' }}>
        <AlertTriangle size={40} style={{ color: 'var(--color-brand-danger)' }} />
        <p className="text-sm text-center max-w-sm" style={{ color: 'var(--color-brand-muted)' }}>
          {loadError}
        </p>
        <button onClick={() => navigate('/dashboard')}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--color-brand-card)', color: 'var(--color-brand-text)', border: '1px solid var(--color-brand-border)' }}>
          Back to Dashboard
        </button>
      </div>
    )
  }

  if (status === 'finalizing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4"
           style={{ background: 'var(--color-brand-bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
             style={{ borderColor: 'var(--color-brand-gold)', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Saving results…</p>
      </div>
    )
  }

  // ─── Active session ────────────────────────────────────────────
  const q          = questions[currentIdx]
  const progress   = (currentIdx / questions.length) * 100
  const isUrgent   = remainingSeconds <= 60
  const isPayout   = q?.type === 'payout'
  const isRoulette = isRouletteQuestion(q)
  const diffLevel  = q?.game_id ? getDifficulty(q.game_id) : null

  // Roulette displays a generated scenario; question_text from DB is not shown.
  // For all other payout drills, inject the odds into the question text.
  const displayText = isRoulette && rouletteScenario
    ? `Winning number: ${rouletteScenario.winningNumber} — what is the total payout for all winning bets? Enter winnings only, do not include the original bet amounts.`
    : (isPayout && !isRoulette && q?.correct_answer)
      ? injectOddsIntoQuestion(q.question_text, q.correct_answer)
      : q?.question_text

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-brand-bg)' }}>

      {/* Hidden elapsed tracker so finalizeSession can read it */}
      <span id="__elapsed__" data-val={elapsedSeconds} style={{ display: 'none' }} />

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
           style={{ background: 'var(--color-brand-card)', borderBottom: '1px solid var(--color-brand-border)' }}>

        {/* Leave button / inline confirmation */}
        {!showLeaveConfirm ? (
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-100 opacity-60"
            style={{ color: 'var(--color-brand-muted)', border: '1px solid var(--color-brand-border)' }}
          >
            <X size={12} /> Leave
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Leave?</span>
            <button
              onClick={() => finalizeSession('abandoned')}
              className="text-xs px-2.5 py-1.5 rounded-lg font-semibold"
              style={{ background: '#2e0a0a', color: 'var(--color-brand-danger)', border: '1px solid var(--color-brand-danger)' }}
            >
              Yes
            </button>
            <button
              onClick={() => setShowLeaveConfirm(false)}
              className="text-xs px-2.5 py-1.5 rounded-lg"
              style={{ color: 'var(--color-brand-muted)', border: '1px solid var(--color-brand-border)' }}
            >
              Cancel
            </button>
          </div>
        )}

        <span className="text-sm font-semibold font-mono shrink-0" style={{ color: 'var(--color-brand-text)' }}>
          {currentIdx + 1}<span style={{ color: 'var(--color-brand-muted)' }}>/{questions.length}</span>
        </span>

        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--color-brand-border)' }}>
          <div className="h-1.5 rounded-full transition-all duration-300"
               style={{ width: `${progress}%`, background: 'var(--color-brand-gold)' }} />
        </div>

        <div className="flex items-center gap-1.5 text-sm font-mono font-semibold shrink-0"
             style={{ color: isUrgent ? 'var(--color-brand-danger)' : 'var(--color-brand-muted)' }}>
          <Clock size={14} className={isUrgent ? 'animate-pulse' : ''} />
          {remainingDisplay}
        </div>
      </div>

      {/* ── Question area ─────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col items-center px-4 py-6 w-full mx-auto ${isPayout ? 'max-w-3xl' : 'max-w-xl'}`}>

        {/* Category + difficulty tags */}
        <div className="flex items-center gap-2 mb-4 self-start flex-wrap">
          {q?.games?.name && (
            <span className="text-sm font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--color-brand-card)', color: 'var(--color-brand-gold)', border: '1px solid var(--color-brand-gold)' }}>
              {q.games.name}
            </span>
          )}
          {q?.category && (
            <span className="text-sm px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--color-brand-card)', color: 'var(--color-brand-text)', border: '1px solid var(--color-brand-border)' }}>
              {q.category}
            </span>
          )}
          {diffLevel && (
            <span className="text-sm px-3 py-1.5 rounded-full font-medium"
                  style={{ color: DIFF_COLOR[diffLevel], border: `1px solid ${DIFF_COLOR[diffLevel]}` }}>
              {DIFF_LABEL[diffLevel]}
            </span>
          )}
        </div>

        {/* Question text */}
        <div className="w-full rounded-2xl p-5 mb-5"
             style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
          <p className="text-base font-medium leading-relaxed" style={{ color: 'var(--color-brand-text)' }}>
            {displayText}
          </p>
        </div>

        {/* ── Payout drill ──────────────────────────────────── */}
        {isPayout && (isRoulette ? rouletteScenario : betContext) && (
          <>
            <div className="w-full mb-5">
              <PayoutTable
                gameName={q?.games?.name ?? ''}
                scenario={isRoulette ? rouletteScenario : null}
                payoutRatio={!isRoulette ? (q?.correct_answer ?? '') : ''}
                chips={!isRoulette ? betContext?.chips : []}
                totalBet={!isRoulette ? betContext?.totalBet : 0}
                activeBet={q?.category === 'ante_bonus' ? 'ante' : 'pair_plus'}
              />
            </div>

            <form onSubmit={handlePayoutSubmit} className="w-full">
              <label className="block text-sm font-medium mb-2"
                     style={{ color: 'var(--color-brand-muted)' }}>
                Enter payout amount
              </label>
              <div className="relative mb-1">
                <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: 'var(--color-brand-muted)' }} />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); setInputError('') }}
                  className="w-full pl-9 pr-4 py-3.5 rounded-xl font-mono text-xl text-center focus:outline-none"
                  style={{
                    background: 'var(--color-brand-card)',
                    border: `1px solid ${inputError ? 'var(--color-brand-danger)' : 'var(--color-brand-border)'}`,
                    color: 'var(--color-brand-text)',
                  }}
                  autoFocus
                />
              </div>
              {inputError && (
                <p className="text-xs mb-3" style={{ color: 'var(--color-brand-danger)' }}>{inputError}</p>
              )}
              <button
                type="submit"
                className="mt-3 w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                style={{ background: 'var(--color-brand-gold)', color: '#0b0f1a' }}
              >
                Submit Answer <ChevronRight size={16} />
              </button>
            </form>
          </>
        )}

        {/* ── Multiple choice ───────────────────────────────── */}
        {!isPayout && Array.isArray(q?.options) && (
          <div className="w-full flex flex-col gap-3">
            {q.options.map((option, i) => {
              const isFocused = i === focusedIdx
              return (
                <button
                  key={`${currentIdx}-${i}`}
                  onClick={() => submitAnswer(option)}
                  onMouseEnter={() => setFocusedIdx(i)}
                  className="w-full text-left px-4 py-4 rounded-xl text-sm font-medium transition-all duration-100"
                  style={{
                    background: isFocused ? '#141100' : 'var(--color-brand-card)',
                    border: `1px solid ${isFocused ? 'var(--color-brand-gold)' : 'var(--color-brand-border)'}`,
                    color: 'var(--color-brand-text)',
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 shrink-0"
                    style={{
                      background: isFocused ? 'var(--color-brand-gold)' : 'var(--color-brand-border)',
                      color:      isFocused ? '#0b0f1a'                 : 'var(--color-brand-muted)',
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </button>
              )
            })}
            <p className="text-xs text-center mt-1" style={{ color: 'var(--color-brand-muted)' }}>
              ↑ ↓ to navigate · Enter to select
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
