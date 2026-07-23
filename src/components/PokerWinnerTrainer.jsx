import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle, XCircle, ChevronRight, RotateCcw, Flame, ListOrdered, ChevronDown,
} from 'lucide-react'
import PlayingCard, { useFeltScale, FeltLabel } from './PlayingCard'
import { generatePokerScenario, RANKINGS } from '../lib/pokerHands'
import useAdvanceOnClick from '../hooks/useAdvanceOnClick'

// ─── Per-game configuration ───────────────────────────────────────────────────

const OPTION_META = {
  player: { label: 'Player',     key: 'P', color: '#22c55e' },
  dealer: { label: 'Dealer',     key: 'D', color: '#ef4444' },
  push:   { label: 'Push',       key: 'T', color: '#4fa8ff' },
  noqual: { label: 'No Qualify', key: 'Q', color: '#f59e0b' },
  pays:   { label: 'Hand Pays',  key: 'P', color: '#22c55e' },
  nopay:  { label: 'No Pay',     key: 'N', color: '#ef4444' },
}

const GAME_CONFIG = {
  csp: {
    options: ['player', 'dealer', 'push', 'noqual'],
    tagline: 'Dealer qualifies with Ace-King or better',
    prompt: 'Who wins this hand?',
    widestRow: 5,  // 5-card hands
    maxScale: 1.6,
  },
  tcp: {
    options: ['player', 'dealer', 'push', 'noqual'],
    tagline: 'Dealer plays with Queen high or better',
    prompt: 'Who wins this hand?',
    widestRow: 3,
    maxScale: 1.9,
  },
  uth: {
    options: ['player', 'dealer', 'push'],
    tagline: 'Best five cards of seven play',
    prompt: 'Who wins this hand?',
    widestRow: 5,  // the board
    maxScale: 1.6,
  },
  lir: {
    options: ['pays', 'nopay'],
    tagline: 'Pays a pair of tens or better',
    prompt: 'Does this hand pay?',
    widestRow: 3,
    maxScale: 1.9,
  },
}

// ─── Card row on the felt ─────────────────────────────────────────────────────

function CardRow({ label, cards, badge, scale, baseDelay, dealKey }) {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-5">
      <div className="w-20 flex justify-end shrink-0">
        <FeltLabel>{label}</FeltLabel>
      </div>
      <div className="flex items-center">
        {cards.map((c, i) => (
          <PlayingCard
            key={`${dealKey}-${label}-${c.rank}${c.suit}`}
            card={c}
            scale={scale}
            rotate={(i - (cards.length - 1) / 2) * 1.6}
            delay={baseDelay + i * 70}
            overlap={i > 0}
          />
        ))}
      </div>
      <div className="w-20 shrink-0">
        {badge && (
          <span className="inline-block text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap"
            style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Rankings reference panel ─────────────────────────────────────────────────

function RankingsPanel({ game }) {
  const data = RANKINGS[game]
  return (
    <div className="rounded-xl p-4 max-w-md"
      style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-1"
        style={{ color: 'var(--color-brand-gold)' }}>
        {data.title}
      </p>
      <p className="text-xs mb-3" style={{ color: 'var(--color-brand-muted)' }}>{data.note}</p>
      {data.rows.map(([hand, pay], i) => (
        <div key={hand} className="flex items-center justify-between py-1.5"
          style={{ borderTop: i > 0 ? '1px solid var(--color-brand-border)' : 'none' }}>
          <span className="text-sm" style={{ color: 'var(--color-brand-text)' }}>{hand}</span>
          <span className="text-xs font-mono font-bold"
            style={{ color: pay === '—' || pay === 'push' ? 'var(--color-brand-muted)' : 'var(--color-brand-teal)' }}>
            {pay}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main trainer ─────────────────────────────────────────────────────────────

export default function PokerWinnerTrainer({ game }) {
  const config = GAME_CONFIG[game]
  const [scenario,     setScenario]     = useState(() => generatePokerScenario(game))
  const [feedback,     setFeedback]     = useState(null) // { chosen, isCorrect }
  const [stats,        setStats]        = useState({ hands: 0, correct: 0, streak: 0, best: 0 })
  const [showRankings, setShowRankings] = useState(false)
  const [dealNum,      setDealNum]      = useState(0) // keys the cards → deal animation runs once per hand
  const [feltRef, scale] = useFeltScale(config.widestRow, config.maxScale)

  // Re-deal when switching games (Practice keeps one mounted instance)
  useEffect(() => {
    setScenario(generatePokerScenario(game))
    setFeedback(null)
    setDealNum(n => n + 1)
  }, [game])

  const nextHand = useCallback(() => {
    setScenario(prev => generatePokerScenario(game, prev))
    setFeedback(null)
    setDealNum(n => n + 1)
  }, [game])

  const choose = useCallback((option) => {
    if (feedback) return
    const isCorrect = option === scenario.outcome
    setFeedback({ chosen: option, isCorrect })
    setStats(s => {
      const streak = isCorrect ? s.streak + 1 : 0
      return {
        hands:   s.hands + 1,
        correct: s.correct + (isCorrect ? 1 : 0),
        streak,
        best:    Math.max(s.best, streak),
      }
    })
  }, [feedback, scenario])

  // Keyboard: option keys to answer, Enter/N/Space for next hand
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      if (feedback) {
        if (k === 'enter' || k === 'n' || k === ' ') { e.preventDefault(); nextHand() }
        return
      }
      const hit = config.options.find(o => OPTION_META[o].key.toLowerCase() === k)
      if (hit) choose(hit)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedback, choose, nextHand, config])

  // Click / tap anywhere (after answering) → next hand
  useAdvanceOnClick(!!feedback, nextHand)

  const accuracy = stats.hands > 0 ? Math.round((stats.correct / stats.hands) * 100) : null
  const accColor = accuracy == null ? 'var(--color-brand-muted)'
    : accuracy >= 80 ? 'var(--color-brand-success)'
    : accuracy >= 60 ? 'var(--color-brand-warning)'
    : 'var(--color-brand-danger)'

  const dealKey = dealNum

  return (
    <div>
      {/* ── Stats bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>
          {config.prompt}
        </p>
        <div className="flex items-center gap-2">
          {stats.streak >= 3 && (
            <span className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-full"
              style={{ color: 'var(--color-brand-gold)', border: '1px solid var(--color-brand-gold-dim)' }}>
              <Flame size={12} />
              {stats.streak}
            </span>
          )}
          {accuracy != null && (
            <span className="text-xs font-mono px-2.5 py-1 rounded-full"
              style={{ color: accColor, border: `1px solid ${accColor}` }}>
              {accuracy}%
            </span>
          )}
          <span className="text-sm font-mono" style={{ color: 'var(--color-brand-muted)' }}>
            <span style={{ color: 'var(--color-brand-success)' }}>{stats.correct}</span>
            <span> / {stats.hands}</span>
          </span>
          {stats.hands > 0 && (
            <button
              onClick={() => setStats({ hands: 0, correct: 0, streak: 0, best: 0 })}
              className="p-1.5 rounded-lg active:scale-[0.95]"
              style={{ color: 'var(--color-brand-muted)', border: '1px solid var(--color-brand-border)' }}
              aria-label="Reset stats"
              title="Reset stats"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Felt table ── */}
      <div
        ref={feltRef}
        className="rounded-3xl px-3 sm:px-8 py-6 mb-5 relative overflow-hidden flex flex-col gap-5"
        style={{
          background: 'radial-gradient(ellipse 120% 90% at 50% -10%, #14724a 0%, #0b4f33 55%, #073d27 100%)',
          border: '1px solid rgba(212, 168, 67, 0.35)',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <p className="text-center text-[10px] font-mono uppercase -mb-1"
          style={{ color: 'rgba(212, 168, 67, 0.55)', letterSpacing: '0.3em' }}>
          {config.tagline}
        </p>

        {scenario.dealerCards && (
          <CardRow label="Dealer" cards={scenario.dealerCards} scale={scale} baseDelay={0} dealKey={dealKey} />
        )}
        {scenario.communityCards && (
          <CardRow
            label={game === 'lir' ? 'Community' : 'Board'}
            cards={scenario.communityCards}
            scale={scale}
            baseDelay={scenario.dealerCards ? scenario.dealerCards.length * 70 + 60 : 0}
            dealKey={dealKey}
          />
        )}
        <CardRow
          label="Player"
          cards={scenario.playerCards}
          scale={scale}
          baseDelay={((scenario.dealerCards?.length ?? 0) + (scenario.communityCards?.length ?? 0)) * 70 + 120}
          dealKey={dealKey}
        />
      </div>

      {/* ── Option buttons ── */}
      <div className={`grid gap-3 mb-5 ${config.options.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : config.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {config.options.map(o => {
          const meta = OPTION_META[o]
          let bg = `${meta.color}1f`
          let border = `${meta.color}55`
          let color = meta.color
          let opacity = 1
          if (feedback) {
            if (o === scenario.outcome) {
              bg = meta.color; color = '#fff'; border = meta.color
            } else if (o === feedback.chosen) {
              bg = 'transparent'; border = 'var(--color-brand-danger)'; color = 'var(--color-brand-danger)'; opacity = 0.9
            } else {
              opacity = 0.3
            }
          }
          return (
            <button
              key={o}
              onClick={() => choose(o)}
              disabled={!!feedback}
              className="py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97]"
              style={{
                background: bg,
                border: `1px solid ${border}`,
                color,
                opacity,
                cursor: feedback ? 'default' : 'pointer',
                transition: 'background-color 150ms ease-out, color 150ms ease-out, opacity 150ms ease-out, transform 100ms ease-out',
              }}
            >
              {meta.label}
              <span className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-mono"
                style={{
                  background: feedback && o === scenario.outcome ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}>
                {meta.key}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Feedback ── */}
      {feedback && (
        <div className="flex flex-col gap-3 mb-5 alert-enter">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background: feedback.isCorrect ? '#0a1f0a' : '#1f0a0a',
              border: `1px solid ${feedback.isCorrect ? 'var(--color-brand-success)' : 'var(--color-brand-danger)'}`,
            }}
          >
            {feedback.isCorrect
              ? <CheckCircle size={20} style={{ color: 'var(--color-brand-success)' }} />
              : <XCircle size={20} style={{ color: 'var(--color-brand-danger)' }} />}
            <span className="font-semibold text-sm"
              style={{ color: feedback.isCorrect ? 'var(--color-brand-success)' : '#fca5a5' }}>
              {feedback.isCorrect
                ? `Correct — ${OPTION_META[scenario.outcome].label}`
                : `Not quite — the call is ${OPTION_META[scenario.outcome].label}`}
            </span>
          </div>

          {/* Hand summaries */}
          <div className={`grid gap-3 ${scenario.dealerName ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="p-3 rounded-xl"
              style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-success)' }}>
              <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-brand-success)' }}>
                Player
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>
                {scenario.playerName}
              </p>
            </div>
            {scenario.dealerName && (
              <div className="p-3 rounded-xl"
                style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-danger)' }}>
                <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-brand-danger)' }}>
                  Dealer
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>
                  {scenario.dealerName}
                </p>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl"
            style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}>
            <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>
              Why
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-brand-text)' }}>
              {scenario.explanation}
            </p>
            {scenario.note && (
              <p className="text-xs leading-relaxed mt-2" style={{ color: 'var(--color-brand-muted)' }}>
                {scenario.note}
              </p>
            )}
          </div>

          <button
            onClick={nextHand}
            className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-1"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }}
          >
            Next Hand <ChevronRight size={16} />
          </button>
          <p className="text-center text-xs -mt-1" style={{ color: 'var(--color-brand-muted)' }}>
            or click anywhere to continue
          </p>
        </div>
      )}

      {/* ── Rankings toggle ── */}
      <div className="mt-2">
        <button
          onClick={() => setShowRankings(v => !v)}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg active:scale-[0.97]"
          style={{
            background: 'var(--color-brand-card)',
            border: '1px solid var(--color-brand-border)',
            color: 'var(--color-brand-muted)',
            transition: 'transform 100ms ease-out',
          }}
        >
          <ListOrdered size={14} />
          {showRankings ? 'Hide' : 'View'} hand rankings &amp; payouts
          <ChevronDown size={14}
            style={{ transform: showRankings ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease-out' }} />
        </button>
        {showRankings && (
          <div className="mt-3 alert-enter">
            <RankingsPanel game={game} />
          </div>
        )}
      </div>
    </div>
  )
}
