import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { randomizeBetAmount } from '../../lib/questionRandomizer'
import { generateRouletteScenario } from '../../lib/rouletteScenario'
import Layout from '../../components/Layout'
import PayoutTable from '../../components/tables/PayoutTable'
import {
  CheckCircle, XCircle, ChevronRight, DollarSign,
  ArrowLeft, GraduationCap, AlertTriangle,
} from 'lucide-react'

function isRouletteQuestion(q) {
  return (q?.games?.name ?? '').toLowerCase().includes('roulette')
}

// ─── Odds injection ───────────────────────────────────────────────────────────

function formatOdds(ratioStr) {
  const r = parseFloat(ratioStr)
  if (isNaN(r)) return ''
  if (r === 1.5)  return '3:2'
  if (r === 0.5)  return '1:2'
  if (Number.isInteger(r)) return `${r}:1`
  return `${r}:1`
}

const HAND_NAMES = [
  'Mini Royal',
  'Royal Flush',
  'Straight Flush',
  'Four of a Kind',
  'Full House',
  'Three of a Kind',
  'Two Pair',
  'Pair of Tens or better',
  'Flush',
  'Straight',
  'Pair',
]

function injectOddsIntoQuestion(text, ratioStr) {
  if (!text || !ratioStr) return text
  const odds = formatOdds(ratioStr)
  if (!odds) return text
  for (const hand of HAND_NAMES) {
    const idx = text.indexOf(hand)
    if (idx !== -1) {
      return text.slice(0, idx + hand.length) + ` (${odds})` + text.slice(idx + hand.length)
    }
  }
  return text
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function checkPayoutAnswer(userAnswer, ratio, betAmount) {
  const ua       = parseFloat(String(userAnswer).replace(/[$,\s]/g, ''))
  const r        = parseFloat(String(ratio))
  if (isNaN(ua) || isNaN(r) || !betAmount) return false
  const expected = Math.round(betAmount * r * 100) / 100
  return Math.abs(ua - expected) < 0.02
}

function checkAnswer(question, userAnswer, betAmount, rouletteScenario) {
  if (question.type === 'payout') {
    if (rouletteScenario) {
      const ua = parseFloat(String(userAnswer).replace(/[$,\s]/g, ''))
      if (isNaN(ua)) return false
      return Math.abs(ua - rouletteScenario.correctPayout) < 0.02
    }
    return checkPayoutAnswer(userAnswer, question.correct_answer, betAmount)
  }
  return String(userAnswer).trim() === String(question.correct_answer).trim()
}

function formatExpected(ratio, betAmount) {
  const val = Math.round(betAmount * parseFloat(ratio) * 100) / 100
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDollars(n) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Game selector card ───────────────────────────────────────────────────────

function GameCard({ name, drillType, count, onClick, disabled }) {
  const typeLabel = drillType === 'payout_drill' ? 'Payout drill' : 'Quiz'
  const typeColor = drillType === 'payout_drill'
    ? 'var(--color-brand-gold)'
    : 'var(--color-brand-blue)'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-left rounded-2xl p-5 disabled:opacity-50 hover-gold active:scale-[0.97]"
      style={{
        background: 'var(--color-brand-card)',
        border: '1px solid var(--color-brand-border)',
        transition: 'border-color 150ms ease-out, transform 100ms ease-out',
      }}
    >
      <p className="font-semibold text-sm mb-1" style={{ color: 'var(--color-brand-text)' }}>
        {name}
      </p>
      <p className="text-xs font-medium" style={{ color: typeColor }}>
        {typeLabel}
      </p>
      {count != null && (
        <p className="text-xs mt-2" style={{ color: 'var(--color-brand-muted)' }}>
          {count} question{count !== 1 ? 's' : ''}
        </p>
      )}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Practice() {
  // ── State ──────────────────────────────────────────────────────
  const [games,       setGames]       = useState([])        // DB game rows
  const [phase,       setPhase]       = useState('loading') // loading|selecting|fetching|practicing
  const [loadError,   setLoadError]   = useState('')

  // Practice session state
  const [selectedGame,     setSelectedGame]     = useState(null)
  const [questions,        setQuestions]        = useState([])
  const [queueIdx,         setQueueIdx]         = useState(0)
  const [betContext,       setBetContext]       = useState(null)
  const [rouletteScenario, setRouletteScenario] = useState(null)
  const [inputValue,       setInputValue]       = useState('')
  const [inputError,       setInputError]       = useState('')
  const [feedback,         setFeedback]         = useState(null)
  const [stats,            setStats]            = useState({ answered: 0, correct: 0 })

  const currentQ = questions.length > 0 ? questions[queueIdx % questions.length] : null

  // ── Load games list on mount ───────────────────────────────────
  useEffect(() => {
    supabase
      .from('games')
      .select('id, name, drill_type')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) { setLoadError('Failed to load games.'); return }
        setGames(data ?? [])
        setPhase('selecting')
      })
  }, [])

  // ── Start practice for a game ──────────────────────────────────
  const startPractice = useCallback(async (gameOption) => {
    setPhase('fetching')
    setLoadError('')

    try {
      let query = supabase
        .from('questions')
        .select('id,game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,chip_variants,difficulty,games(name)')
        .eq('is_active', true)

      if (gameOption.id === 'procedure') {
        query = query.eq('is_procedure', true)
      } else if (gameOption.id !== 'mixed') {
        query = query.eq('game_id', gameOption.id)
      }

      const { data, error } = await query.limit(300)
      if (error) throw error

      const prepared = shuffle(data ?? []).map(q => {
        if (q.type === 'multiple_choice' && Array.isArray(q.options)) {
          return { ...q, options: shuffle([...q.options]) }
        }
        return q
      })

      if (prepared.length === 0) throw new Error('No questions found for this selection.')

      logAudit('PRACTICE_STARTED', {
        scope: gameOption.id,
        scope_name: gameOption.name,
        question_pool: prepared.length,
      })

      const firstQ      = prepared[0]
      const firstIsRoul = isRouletteQuestion(firstQ)
      const firstBet    = firstQ?.type === 'payout' && !firstIsRoul
        ? randomizeBetAmount(firstQ) : null
      const firstScen   = firstIsRoul ? generateRouletteScenario() : null

      setQuestions(prepared)
      setQueueIdx(0)
      setBetContext(firstBet)
      setRouletteScenario(firstScen)
      setInputValue('')
      setInputError('')
      setFeedback(null)
      setStats({ answered: 0, correct: 0 })
      setSelectedGame(gameOption)
      setPhase('practicing')
    } catch (err) {
      setLoadError(err.message ?? 'Failed to load questions.')
      setPhase('selecting')
    }
  }, [])

  // ── Submit answer ──────────────────────────────────────────────
  const submitAnswer = useCallback((userAnswer) => {
    if (!currentQ || feedback) return

    const isRoul    = isRouletteQuestion(currentQ)
    const isCorrect = checkAnswer(currentQ, userAnswer, betContext?.totalBet ?? 0, rouletteScenario)

    let correctDisplay
    if (isRoul && rouletteScenario) {
      correctDisplay = fmtDollars(rouletteScenario.correctPayout)
    } else if (currentQ.type === 'payout' && betContext) {
      correctDisplay = formatExpected(currentQ.correct_answer, betContext.totalBet)
    } else {
      correctDisplay = currentQ.correct_answer
    }

    setFeedback({
      isCorrect,
      correctDisplay,
      explanation:      isRoul ? null : currentQ.explanation,
      rouletteScenario: isRoul ? rouletteScenario : null,
      userAnswer:       String(userAnswer),
    })
    setStats(s => ({
      answered: s.answered + 1,
      correct:  s.correct + (isCorrect ? 1 : 0),
    }))
  }, [currentQ, feedback, betContext, rouletteScenario])

  // ── Next question ──────────────────────────────────────────────
  const nextQuestion = useCallback(() => {
    const nextIdx = queueIdx + 1

    // Reshuffle on pool exhaustion
    let nextQuestions = questions
    let resolvedIdx   = nextIdx
    if (nextIdx >= questions.length) {
      nextQuestions = shuffle([...questions])
      resolvedIdx   = 0
      setQuestions(nextQuestions)
    }

    const nextQ      = nextQuestions[resolvedIdx % nextQuestions.length]
    const nextIsRoul = isRouletteQuestion(nextQ)
    setBetContext(nextQ?.type === 'payout' && !nextIsRoul ? randomizeBetAmount(nextQ) : null)
    setRouletteScenario(nextIsRoul ? generateRouletteScenario() : null)
    setQueueIdx(resolvedIdx)
    setInputValue('')
    setInputError('')
    setFeedback(null)
  }, [queueIdx, questions])

  // ── Enter key → next question (after feedback is shown) ────────
  useEffect(() => {
    if (!feedback) return
    const onKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        nextQuestion()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedback, nextQuestion])

  const handlePayoutSubmit = (e) => {
    e.preventDefault()
    const raw = inputValue.trim()
    if (!raw) { setInputError('Enter a dollar amount.'); return }
    const num = parseFloat(raw.replace(/[$,]/g, ''))
    if (isNaN(num) || num < 0) { setInputError('Enter a valid dollar amount.'); return }
    submitAnswer(raw)
  }

  const backToSelector = () => {
    setPhase('selecting')
    setSelectedGame(null)
    setQuestions([])
    setFeedback(null)
    setStats({ answered: 0, correct: 0 })
  }

  // ── Loading games ──────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 rounded-full border-2 animate-spin"
               style={{ borderColor: 'var(--color-brand-gold)', borderTopColor: 'transparent' }} />
        </div>
      </Layout>
    )
  }

  // ── Game selector ──────────────────────────────────────────────
  if (phase === 'selecting' || phase === 'fetching') {
    const loading = phase === 'fetching'

    return (
      <Layout>
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
          >
            <GraduationCap size={18} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-brand-text)' }}>
              Practice Mode
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
              Score and performance stats are not affected
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div
          className="flex items-start gap-2.5 p-3 rounded-lg mb-6 text-sm mt-4"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
        >
          <GraduationCap size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--color-brand-muted)' }} />
          <span style={{ color: 'var(--color-brand-muted)' }}>
            Practice lets you drill any game without cooldowns, scoring, or performance tracking.
            Correct answers and explanations are shown immediately after each question.
          </span>
        </div>

        {loadError && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
            style={{ background: '#1f0a0a', border: '1px solid var(--color-brand-danger)', color: '#fca5a5' }}
          >
            <AlertTriangle size={15} />
            {loadError}
          </div>
        )}

        <p className="text-xs font-medium uppercase tracking-widest mb-3"
           style={{ color: 'var(--color-brand-muted)' }}>
          Choose a game
        </p>

        {/* Game cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
          {games.map(game => (
            <GameCard
              key={game.id}
              name={game.name}
              drillType={game.drill_type}
              onClick={() => startPractice({ id: game.id, name: game.name, drillType: game.drill_type })}
              disabled={loading}
            />
          ))}

          {/* Procedures */}
          <GameCard
            name="Procedures"
            drillType="quiz"
            onClick={() => startPractice({ id: 'procedure', name: 'Procedures', drillType: 'quiz' })}
            disabled={loading}
          />

          {/* Mixed */}
          <GameCard
            name="Mixed — All Games"
            drillType="quiz"
            onClick={() => startPractice({ id: 'mixed', name: 'Mixed — All Games', drillType: 'mixed' })}
            disabled={loading}
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-6 gap-2">
            <div className="w-5 h-5 rounded-full border-2 animate-spin"
                 style={{ borderColor: 'var(--color-brand-gold)', borderTopColor: 'transparent' }} />
            <span className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Loading questions…</span>
          </div>
        )}
      </Layout>
    )
  }

  // ── Practice session ───────────────────────────────────────────
  if (!currentQ) return null

  const isPayout   = currentQ.type === 'payout'
  const isRoulette = isRouletteQuestion(currentQ)
  const accuracy   = stats.answered > 0
    ? Math.round((stats.correct / stats.answered) * 100)
    : null

  const displayText = isRoulette && rouletteScenario
    ? `Winning number: ${rouletteScenario.winningNumber}. Calculate the total payout for all winning bets. Do not include the original bet amounts.`
    : (isPayout && !isRoulette && currentQ?.correct_answer)
      ? injectOddsIntoQuestion(currentQ.question_text, currentQ.correct_answer)
      : currentQ.question_text

  return (
    <Layout>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={backToSelector}
            className="flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--color-brand-muted)' }}
          >
            <ArrowLeft size={15} />
            Change game
          </button>
          <span style={{ color: 'var(--color-brand-border)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'var(--color-brand-text)' }}>
            {selectedGame?.name}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3">
          {accuracy != null && (
            <span
              className="text-xs font-mono px-2.5 py-1 rounded-full"
              style={{
                color: accuracy >= 80
                  ? 'var(--color-brand-success)'
                  : accuracy >= 60
                    ? 'var(--color-brand-warning)'
                    : 'var(--color-brand-danger)',
                border: `1px solid ${accuracy >= 80
                  ? 'var(--color-brand-success)'
                  : accuracy >= 60
                    ? 'var(--color-brand-warning)'
                    : 'var(--color-brand-danger)'}`,
              }}
            >
              {accuracy}%
            </span>
          )}
          <span className="text-sm font-mono" style={{ color: 'var(--color-brand-muted)' }}>
            <span style={{ color: 'var(--color-brand-success)' }}>{stats.correct}</span>
            <span> / {stats.answered}</span>
          </span>
        </div>
      </div>

      {/* Game + Category tags */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {currentQ.games?.name && (
          <span
            className="text-sm font-semibold px-3 py-1.5 rounded-full"
            style={{
              background: 'var(--color-brand-card)',
              color: 'var(--color-brand-gold)',
              border: '1px solid var(--color-brand-gold)',
            }}
          >
            {currentQ.games.name}
          </span>
        )}
        {currentQ.category && (
          <span
            className="text-sm px-3 py-1.5 rounded-full"
            style={{
              background: 'var(--color-brand-card)',
              color: 'var(--color-brand-text)',
              border: '1px solid var(--color-brand-border)',
            }}
          >
            {currentQ.category}
          </span>
        )}
      </div>

      {/* Question card */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
      >
        <p className="text-base font-medium leading-relaxed" style={{ color: 'var(--color-brand-text)' }}>
          {displayText}
        </p>
      </div>

      {/* ── Payout drill ────────────────────────────────────────── */}
      {isPayout && (isRoulette ? rouletteScenario : betContext) && !feedback && (
        <>
          <div className="mb-5">
            <PayoutTable
              gameName={currentQ?.games?.name ?? ''}
              scenario={isRoulette ? rouletteScenario : null}
              payoutRatio={!isRoulette ? (currentQ?.correct_answer ?? '') : ''}
              chips={!isRoulette ? betContext?.chips : []}
              totalBet={!isRoulette ? betContext?.totalBet : 0}
              activeBet={currentQ?.category === 'ante_bonus' ? 'ante' : 'pair_plus'}
            />
          </div>

          <form onSubmit={handlePayoutSubmit} className="mb-2">
            <label className="block text-sm font-medium mb-2"
                   style={{ color: 'var(--color-brand-muted)' }}>
              Enter payout amount
            </label>
            <div className="relative mb-1">
              <DollarSign size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
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
              Submit <ChevronRight size={16} />
            </button>
          </form>
        </>
      )}

      {/* ── Multiple choice ────────────────────────────────────── */}
      {!isPayout && Array.isArray(currentQ.options) && !feedback && (
        <div className="flex flex-col gap-3 mb-2">
          {currentQ.options.map((option, i) => (
            <button
              key={`${queueIdx}-${i}`}
              onClick={() => submitAnswer(option)}
              className="w-full text-left px-4 py-4 rounded-xl text-sm font-medium hover-gold active:scale-[0.98]"
              style={{
                background: 'var(--color-brand-card)',
                border: '1px solid var(--color-brand-border)',
                color: 'var(--color-brand-text)',
                transition: 'background-color 100ms ease-out, border-color 100ms ease-out, transform 100ms ease-out',
              }}
            >
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 shrink-0"
                style={{ background: 'var(--color-brand-border)', color: 'var(--color-brand-muted)' }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {option}
            </button>
          ))}
        </div>
      )}

      {/* ── Payout table (after answer, read-only context) ────── */}
      {isPayout && (isRoulette ? rouletteScenario : betContext) && feedback && (
        <div className="mb-4">
          <PayoutTable
            gameName={currentQ?.games?.name ?? ''}
            scenario={isRoulette ? rouletteScenario : null}
            payoutRatio={!isRoulette ? (currentQ?.correct_answer ?? '') : ''}
            chips={!isRoulette ? betContext?.chips : []}
            totalBet={!isRoulette ? betContext?.totalBet : 0}
            activeBet={currentQ?.category === 'ante_bonus' ? 'ante' : 'pair_plus'}
          />
        </div>
      )}

      {/* ── Feedback panel ────────────────────────────────────── */}
      {feedback && (
        <div className="flex flex-col gap-3 mb-5">

          {/* Result banner */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background: feedback.isCorrect ? '#0a1f0a' : '#1f0a0a',
              border: `1px solid ${feedback.isCorrect ? 'var(--color-brand-success)' : 'var(--color-brand-danger)'}`,
            }}
          >
            {feedback.isCorrect
              ? <CheckCircle size={20} style={{ color: 'var(--color-brand-success)' }} />
              : <XCircle    size={20} style={{ color: 'var(--color-brand-danger)'   }} />
            }
            <span className="font-semibold text-sm"
                  style={{ color: feedback.isCorrect ? 'var(--color-brand-success)' : '#fca5a5' }}>
              {feedback.isCorrect ? 'Correct!' : 'Incorrect'}
            </span>
          </div>

          {/* Your answer / correct answer */}
          {!feedback.isCorrect && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl" style={{ background: '#1f0a0a' }}>
                <p className="text-xs uppercase tracking-widest mb-1.5"
                   style={{ color: 'var(--color-brand-danger)' }}>
                  Your answer
                </p>
                <p className="text-sm font-mono" style={{ color: '#fca5a5' }}>
                  {isPayout ? `$${parseFloat(feedback.userAnswer.replace(/[$,]/g,'')).toFixed(2)}` : feedback.userAnswer}
                </p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: '#0a1f0a' }}>
                <p className="text-xs uppercase tracking-widest mb-1.5"
                   style={{ color: 'var(--color-brand-success)' }}>
                  Correct answer
                </p>
                <p className="text-sm font-mono" style={{ color: '#86efac' }}>
                  {feedback.correctDisplay}
                </p>
              </div>
            </div>
          )}

          {/* Explanation (non-Roulette) */}
          {feedback.explanation && !feedback.rouletteScenario && (
            <div className="p-3 rounded-xl" style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}>
              <p className="text-xs uppercase tracking-widest mb-1.5"
                 style={{ color: 'var(--color-brand-muted)' }}>
                Explanation
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-brand-text)' }}>
                {feedback.explanation}
              </p>
            </div>
          )}

          {/* Roulette bet breakdown */}
          {feedback.rouletteScenario && (() => {
            const scen   = feedback.rouletteScenario
            const winStr = String(scen.winningNumber)
            const winners = scen.bets.filter(b => b.numbers.some(n => String(n) === winStr))
            const losers  = scen.bets.filter(b => !b.numbers.some(n => String(n) === winStr))
            return (
              <div className="rounded-xl overflow-hidden"
                style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}>
                <div className="px-3 pt-3 pb-1">
                  <p className="text-xs uppercase tracking-widest mb-2"
                    style={{ color: 'var(--color-brand-muted)' }}>Payout Breakdown</p>

                  {winners.length > 0 && (
                    <>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-brand-success)' }}>
                        ✓ Winning Bets
                      </p>
                      {winners.map((b, i) => (
                        <div key={i} className="flex items-center justify-between text-xs mb-1">
                          <span style={{ color: '#d1fae5' }}>{b.label}</span>
                          <span className="font-mono" style={{ color: '#86efac' }}>
                            ${b.amount} × {b.payout}:1 = ${b.amount * b.payout}
                          </span>
                        </div>
                      ))}
                    </>
                  )}

                  {losers.length > 0 && (
                    <>
                      <p className="text-xs font-semibold mt-2 mb-1" style={{ color: 'var(--color-brand-danger)' }}>
                        ✗ Losing Bets
                      </p>
                      {losers.map((b, i) => (
                        <div key={i} className="flex items-center justify-between text-xs mb-1">
                          <span style={{ color: '#fca5a5' }}>{b.label}</span>
                          <span className="font-mono" style={{ color: '#9ca3af' }}>—</span>
                        </div>
                      ))}
                    </>
                  )}

                  <div className="flex items-center justify-between text-sm font-bold mt-3 pt-2"
                    style={{ borderTop: '1px solid var(--color-brand-border)' }}>
                    <span style={{ color: 'var(--color-brand-text)' }}>Total Payout</span>
                    <span className="font-mono" style={{ color: 'var(--color-brand-gold)' }}>
                      {fmtDollars(scen.correctPayout)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Next button */}
          <button
            onClick={nextQuestion}
            className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-1"
            style={{ background: 'var(--color-brand-gold)', color: '#0b0f1a' }}
          >
            Next Question <ChevronRight size={16} />
          </button>
        </div>
      )}
    </Layout>
  )
}
