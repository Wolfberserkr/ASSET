import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { hasCoarsePointer } from '../../lib/device'
import { randomizeBetAmount } from '../../lib/questionRandomizer'
import { fetchAllRows } from '../../lib/fetchAllRows'
import { generateRouletteScenario } from '../../lib/rouletteScenario'
import useAdvanceOnClick from '../../hooks/useAdvanceOnClick'
import Layout from '../../components/Layout'
import PayoutTable from '../../components/tables/PayoutTable'
import BlackjackTrainer from '../../components/BlackjackTrainer'
import PokerWinnerTrainer from '../../components/PokerWinnerTrainer'
import {
  CheckCircle, XCircle, ChevronRight, DollarSign,
  ArrowLeft, GraduationCap, AlertTriangle, Spade, Club,
} from 'lucide-react'

// Poker games with a winner / hand-recognition trainer in Practice
const WINNER_GAMES = {
  'Caribbean Stud Poker':   { key: 'csp', short: 'Caribbean Stud' },
  "Ultimate Texas Hold'em": { key: 'uth', short: 'Ultimate Hold’em' },
  'Let It Ride':            { key: 'lir', short: 'Let It Ride' },
  'Three Card Poker':       { key: 'tcp', short: 'Three Card Poker' },
}

function isRouletteQuestion(q) {
  return (q?.games?.name ?? '').toLowerCase().includes('roulette')
}

// Picks which betting spot a payout table should highlight, per game.
function deriveActiveBet(q) {
  const name = (q?.games?.name ?? '').toLowerCase()
  const cat  = q?.category ?? ''
  if (name.includes('caribbean')) return cat === 'csp_ante' ? 'ante' : 'bet'
  if (name.includes('craps')) {
    if (cat === 'craps_field') return 'field'
    if (cat === 'craps_prop' || cat === 'craps_hardway') return 'center'
    return 'line'
  }
  return cat === 'ante_bonus' ? 'ante' : 'pair_plus'
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
  // Newer seeded questions already state the odds in the text (e.g. "pays 2:1")
  // — don't inject a second copy.
  if (/\d+\s*(?::|\s+to\s+)\s*\d+/i.test(text)) return text
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
    ? 'var(--color-brand-teal)'
    : 'var(--color-brand-cyan)'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-left rounded-2xl p-5 disabled:opacity-50 hover-accent active:scale-[0.97]"
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

// ─── Trainer cards (gold-bordered specials in the game picker) ───────────────

function TrainerCard({ icon: Icon, title, subtitle, detail, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-left rounded-2xl p-5 disabled:opacity-50 hover-accent active:scale-[0.97]"
      style={{
        background: 'var(--color-brand-card)',
        border: '1px solid var(--color-brand-gold-dim)',
        transition: 'border-color 150ms ease-out, transform 100ms ease-out',
      }}
    >
      <p className="font-semibold text-sm mb-1 flex items-center gap-1.5"
        style={{ color: 'var(--color-brand-text)' }}>
        <Icon size={13} style={{ color: 'var(--color-brand-gold)' }} />
        {title}
      </p>
      <p className="text-xs font-medium" style={{ color: 'var(--color-brand-gold)' }}>
        {subtitle}
      </p>
      <p className="text-xs mt-2" style={{ color: 'var(--color-brand-muted)' }}>
        {detail}
      </p>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Practice() {
  // ── State ──────────────────────────────────────────────────────
  const [games,       setGames]       = useState([])        // DB game rows
  const [phase,       setPhase]       = useState('loading') // loading|selecting|fetching|practicing|strategy
  const [loadError,   setLoadError]   = useState('')

  // Practice session state
  const [selectedGame,     setSelectedGame]     = useState(null)
  const [winnerGame,       setWinnerGame]       = useState(null) // { key, name } for phase 'winner'
  const [questions,        setQuestions]        = useState([])
  const [queueIdx,         setQueueIdx]         = useState(0)
  const [betContext,       setBetContext]       = useState(null)
  const [rouletteScenario, setRouletteScenario] = useState(null)
  const [inputValue,       setInputValue]       = useState('')
  const [inputError,       setInputError]       = useState('')
  const [feedback,         setFeedback]         = useState(null)
  const [stats,            setStats]            = useState({ answered: 0, correct: 0 })

  const [searchParams] = useSearchParams()

  // Accumulates the current game's practice for the append-only
  // practice_activity log (drives remediation practice credits). Kept in a
  // ref so the unmount flush always sees the latest counts.
  const activityRef = useRef({ gameId: null, scope: null, answered: 0, correct: 0 })

  // Write the accumulated practice for the game just left, then reset. Only
  // the standard question-practice flow logs — trainers don't (different skill).
  const flushActivity = useCallback(() => {
    const a = activityRef.current
    if (a.answered > 0 && a.scope) {
      supabase.from('practice_activity').insert({
        game_id: a.gameId,
        scope: a.scope,
        questions_answered: a.answered,
        correct: a.correct,
      }).then(() => {}, () => {}) // fire-and-forget; practice never blocks on this
    }
    activityRef.current = { gameId: null, scope: null, answered: 0, correct: 0 }
  }, [])

  const currentQ = questions.length > 0 ? questions[queueIdx % questions.length] : null

  // Remount Layout's page container when the view swaps (see Layout
  // contentKey). 'fetching' keeps the picker on screen, so it shares its key.
  const viewKey = phase === 'fetching' ? 'selecting' : phase

  // Layout's <main> is the scroll pane and phase changes replace the whole
  // page in place — without this, opening a trainer from a scrolled-down
  // picker keeps the old scroll offset, landing the agent mid-page (and the
  // area below the shorter page can briefly show stale pixels).
  useEffect(() => {
    document.querySelector('main')?.scrollTo(0, 0)
  }, [phase])

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

  // Flush any in-progress practice when leaving the page entirely.
  useEffect(() => () => flushActivity(), [flushActivity])

  // Deep-link: /practice?game=<uuid|procedure> auto-starts focused practice
  // (the remediation "Practice" button on the agent dashboard uses this).
  useEffect(() => {
    const g = searchParams.get('game')
    if (!g || games.length === 0) return
    if (g === 'procedure') {
      startPractice({ id: 'procedure', name: 'Procedures', drillType: 'quiz' })
    } else {
      const match = games.find(x => x.id === g)
      if (match) startPractice({ id: match.id, name: match.name, drillType: match.drill_type })
    }
    // Fire once when the games list first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games])

  // ── Start practice for a game ──────────────────────────────────
  const startPractice = useCallback(async (gameOption) => {
    flushActivity() // persist any practice from the previous game first
    setPhase('fetching')
    setLoadError('')

    try {
      const buildQuery = () => {
        let query = supabase
          .from('questions')
          .select('id,game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,chip_variants,difficulty,games(name)')
          .eq('is_active', true)

        if (gameOption.id === 'procedure') {
          query = query.eq('is_procedure', true)
        } else if (gameOption.id !== 'mixed') {
          query = query.eq('game_id', gameOption.id)
        }
        return query
      }

      const data = await fetchAllRows(buildQuery)

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
      activityRef.current = {
        gameId: (gameOption.id === 'procedure' || gameOption.id === 'mixed') ? null : gameOption.id,
        scope:  gameOption.id === 'procedure' ? 'procedure' : gameOption.id === 'mixed' ? 'mixed' : 'game',
        answered: 0, correct: 0,
      }
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
    activityRef.current.answered += 1
    if (isCorrect) activityRef.current.correct += 1
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

  // Click / tap anywhere (after answering) → next question
  useAdvanceOnClick(!!feedback, nextQuestion)

  const handlePayoutSubmit = (e) => {
    e.preventDefault()
    const raw = inputValue.trim()
    if (!raw) { setInputError('Enter a dollar amount.'); return }
    const num = parseFloat(raw.replace(/[$,]/g, ''))
    if (isNaN(num) || num < 0) { setInputError('Enter a valid dollar amount.'); return }
    submitAnswer(raw)
  }

  const backToSelector = () => {
    flushActivity()
    setPhase('selecting')
    setSelectedGame(null)
    setWinnerGame(null)
    setQuestions([])
    setFeedback(null)
    setStats({ answered: 0, correct: 0 })
  }

  const startStrategyTrainer = () => {
    logAudit('PRACTICE_STARTED', {
      scope: 'blackjack_strategy',
      scope_name: 'Blackjack Strategy Trainer',
    })
    setPhase('strategy')
  }

  const startWinnerTrainer = (gameName) => {
    const { key, short } = WINNER_GAMES[gameName]
    logAudit('PRACTICE_STARTED', {
      scope: 'winner_trainer',
      scope_name: `${gameName} Hand Trainer`,
    })
    setWinnerGame({ key, name: short })
    setPhase('winner')
  }

  // ── Loading games ──────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <Layout contentKey={viewKey}>
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 rounded-full border-2 animate-spin"
               style={{ borderColor: 'var(--color-brand-cyan)', borderTopColor: 'transparent' }} />
        </div>
      </Layout>
    )
  }

  // ── Game selector ──────────────────────────────────────────────
  if (phase === 'selecting' || phase === 'fetching') {
    const loading = phase === 'fetching'

    return (
      <Layout contentKey={viewKey}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
          >
            <GraduationCap size={18} style={{ color: 'var(--color-brand-cyan)' }} />
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

        {/* ── Practice: drill real question pools ─────────────────── */}
        <div className="flex items-baseline gap-2 mb-3">
          <p className="text-xs font-medium uppercase tracking-widest"
             style={{ color: 'var(--color-brand-muted)' }}>
            Practice
          </p>
          <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
            Drill the question pools with instant feedback
          </span>
        </div>

        {/* Practice game cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-8">
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

        {/* ── Training: interactive skill trainers ────────────────── */}
        <div className="flex items-baseline gap-2 mb-3">
          <p className="text-xs font-medium uppercase tracking-widest"
             style={{ color: 'var(--color-brand-gold)' }}>
            Training
          </p>
          <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
            Interactive skill trainers — no question pool
          </span>
        </div>

        {/* Trainer cards (gold-bordered) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
          {games.some(g => g.name === 'Blackjack') && (
            <TrainerCard
              icon={Spade}
              title="Blackjack Strategy"
              subtitle="Basic strategy trainer"
              detail="Hit · Stand · Double · Split"
              onClick={startStrategyTrainer}
              disabled={loading}
            />
          )}
          {games.filter(g => WINNER_GAMES[g.name]).map(game => (
            <TrainerCard
              key={`trainer-${game.id}`}
              icon={Club}
              title={`${WINNER_GAMES[game.name].short} Hands`}
              subtitle="Hand recognition trainer"
              detail={game.name === 'Let It Ride' ? 'Pays · No Pay' : 'Player · Dealer · Push'}
              onClick={() => startWinnerTrainer(game.name)}
              disabled={loading}
            />
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-6 gap-2">
            <div className="w-5 h-5 rounded-full border-2 animate-spin"
                 style={{ borderColor: 'var(--color-brand-cyan)', borderTopColor: 'transparent' }} />
            <span className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Loading questions…</span>
          </div>
        )}
      </Layout>
    )
  }

  // ── Blackjack strategy trainer ─────────────────────────────────
  if (phase === 'strategy') {
    return (
      <Layout contentKey={viewKey}>
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
            <span className="text-sm font-medium flex items-center gap-1.5"
              style={{ color: 'var(--color-brand-text)' }}>
              <Spade size={13} style={{ color: 'var(--color-brand-gold)' }} />
              Blackjack Strategy
            </span>
          </div>
        </div>
        <BlackjackTrainer />
      </Layout>
    )
  }

  // ── Poker winner / hand recognition trainer ────────────────────
  if (phase === 'winner' && winnerGame) {
    return (
      <Layout contentKey={viewKey}>
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
            <span className="text-sm font-medium flex items-center gap-1.5"
              style={{ color: 'var(--color-brand-text)' }}>
              <Club size={13} style={{ color: 'var(--color-brand-gold)' }} />
              {winnerGame.name} — Hand Trainer
            </span>
          </div>
        </div>
        <PokerWinnerTrainer game={winnerGame.key} />
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
    <Layout contentKey={viewKey}>
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
              color: 'var(--color-brand-cyan)',
              border: '1px solid var(--color-brand-cyan)',
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
              perSpotBet={!isRoulette ? betContext?.perSpotBet : undefined}
              activeBet={deriveActiveBet(currentQ)}
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
                autoFocus={!hasCoarsePointer}
              />
            </div>
            {inputError && (
              <p className="text-xs mb-3" style={{ color: 'var(--color-brand-danger)' }}>{inputError}</p>
            )}
            <button
              type="submit"
              className="mt-3 w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }}
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
              className="w-full text-left px-4 py-4 rounded-xl text-sm font-medium hover-accent active:scale-[0.98]"
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
            perSpotBet={!isRoulette ? betContext?.perSpotBet : undefined}
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
                    <span className="font-mono" style={{ color: 'var(--color-brand-teal)' }}>
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
            style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }}
          >
            Next Question <ChevronRight size={16} />
          </button>
          <p className="text-center text-xs -mt-1" style={{ color: 'var(--color-brand-muted)' }}>
            or click anywhere to continue
          </p>
        </div>
      )}
    </Layout>
  )
}
