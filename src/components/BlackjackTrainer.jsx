import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle, XCircle, ChevronRight, RotateCcw, Flame, Table2, ChevronDown,
} from 'lucide-react'
import {
  DEALER_LABELS, CHART_SECTIONS, generateScenario, explainRule,
} from '../lib/blackjackStrategy'
import PlayingCard, { CardBack, useFeltScale } from './PlayingCard'

// ─── Action + chart cell styling (mirrors the printed chart's color code) ─────

const ACTION_META = {
  H: { label: 'Hit',    color: '#22c55e', cell: '#1e8e4e' },
  S: { label: 'Stand',  color: '#ef4444', cell: '#d03a34' },
  D: { label: 'Double', color: '#4fa8ff', cell: '#2e6bd6' },
  P: { label: 'Split',  color: '#f59e0b', cell: '#d98e04' },
}

const CELL_LABEL = { H: 'H', S: 'S', D: 'D', P: 'SP' }

// ─── Strategy chart pieces ────────────────────────────────────────────────────

function ChartCells({ actions, highlightIdx = -1, size = 'md' }) {
  const h = size === 'md' ? 30 : 24
  return (
    <>
      {actions.map((a, i) => (
        <div
          key={i}
          className="flex-1 flex items-center justify-center rounded font-bold"
          style={{
            height: h,
            minWidth: size === 'md' ? 28 : 24,
            fontSize: size === 'md' ? 11 : 10,
            background: ACTION_META[a].cell,
            color: '#fff',
            outline: i === highlightIdx ? '2px solid var(--color-brand-gold)' : 'none',
            outlineOffset: 1,
            zIndex: i === highlightIdx ? 1 : 0,
            position: 'relative',
          }}
        >
          {CELL_LABEL[a]}
        </div>
      ))}
    </>
  )
}

function ChartHeader({ highlightIdx = -1, size = 'md' }) {
  return (
    <>
      {DEALER_LABELS.map((d, i) => (
        <div
          key={d}
          className="flex-1 flex items-center justify-center font-mono font-bold"
          style={{
            minWidth: size === 'md' ? 28 : 24,
            height: 20,
            fontSize: 10,
            color: i === highlightIdx ? 'var(--color-brand-gold)' : 'var(--color-brand-muted)',
          }}
        >
          {d}
        </div>
      ))}
    </>
  )
}

// The single chart row for the hand just played, dealer column highlighted.
function MiniChartRow({ scenario }) {
  const rowLabel = scenario.category === 'soft'
    ? `A/${scenario.key}`
    : scenario.category === 'pair'
      ? (scenario.key === 'A' ? 'A/A' : `${scenario.key}/${scenario.key}`)
      : String(scenario.key)

  return (
    <div className="p-3 rounded-xl" style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}>
      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--color-brand-muted)' }}>
        Chart row — dealer shows {DEALER_LABELS[scenario.dealerIdx]}
      </p>
      <div className="flex items-center gap-1">
        <div className="w-10 shrink-0" />
        <ChartHeader highlightIdx={scenario.dealerIdx} />
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <div className="w-10 shrink-0 text-xs font-mono font-bold text-right pr-1"
          style={{ color: 'var(--color-brand-text)' }}>
          {rowLabel}
        </div>
        <ChartCells actions={scenario.row} highlightIdx={scenario.dealerIdx} />
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-2.5">
        {Object.entries(ACTION_META).map(([a, meta]) => (
          <span key={a} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: meta.cell }} />
            {CELL_LABEL[a]} = {meta.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function FullChart() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {CHART_SECTIONS.map(section => (
        <div key={section.id} className="rounded-xl p-3"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--color-brand-gold)' }}>
            {section.title}
          </p>
          <div className="table-responsive">
            <div style={{ minWidth: 300 }}>
              <div className="flex items-center gap-0.5">
                <div className="w-9 shrink-0 text-[10px] text-right pr-1" style={{ color: 'var(--color-brand-muted)' }}>
                  vs
                </div>
                <ChartHeader size="sm" />
              </div>
              {section.rows.map(({ label, actions }) => (
                <div key={label} className="flex items-center gap-0.5 mt-0.5">
                  <div className="w-9 shrink-0 text-[11px] font-mono font-bold text-right pr-1"
                    style={{ color: 'var(--color-brand-text)' }}>
                    {label}
                  </div>
                  <ChartCells actions={actions} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Mode filter chips (M3 filter-chip style) ─────────────────────────────────

const MODES = [
  { id: 'all',  label: 'All Hands' },
  { id: 'hard', label: 'Hard Totals' },
  { id: 'soft', label: 'Soft Totals' },
  { id: 'pair', label: 'Pairs' },
]

// ─── Main trainer ─────────────────────────────────────────────────────────────

export default function BlackjackTrainer() {
  const [mode,      setMode]      = useState('all')
  const [scenario,  setScenario]  = useState(() => generateScenario('all'))
  const [feedback,  setFeedback]  = useState(null) // { chosen, isCorrect, rule, text }
  const [stats,     setStats]     = useState({ hands: 0, correct: 0, streak: 0, best: 0 })
  const [showChart, setShowChart] = useState(false)
  const [dealNum,   setDealNum]   = useState(0) // keys the cards → deal animation runs once per hand
  const [feltRef, cardScale] = useFeltScale(2, 2) // rows of 2 cards, up to 2× size

  const nextHand = useCallback((m) => {
    setScenario(prev => generateScenario(m ?? mode, prev))
    setFeedback(null)
    setDealNum(n => n + 1)
  }, [mode])

  const changeMode = (m) => {
    setMode(m)
    nextHand(m)
  }

  const choose = useCallback((action) => {
    if (feedback) return
    if (action === 'P' && !scenario.isPair) return
    const isCorrect = action === scenario.correct
    const { rule, text } = explainRule(scenario.category, scenario.key, scenario.dealerIdx)
    setFeedback({ chosen: action, isCorrect, rule, text })
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

  // Keyboard: H/S/D/P to act, Enter/N/Space for next hand
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      if (feedback) {
        if (k === 'enter' || k === 'n' || k === ' ') { e.preventDefault(); nextHand() }
        return
      }
      if (k === 'h') choose('H')
      else if (k === 's') choose('S')
      else if (k === 'd') choose('D')
      else if (k === 'p') choose('P')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedback, choose, nextHand])

  const accuracy = stats.hands > 0 ? Math.round((stats.correct / stats.hands) * 100) : null
  const accColor = accuracy == null ? 'var(--color-brand-muted)'
    : accuracy >= 80 ? 'var(--color-brand-success)'
    : accuracy >= 60 ? 'var(--color-brand-warning)'
    : 'var(--color-brand-danger)'

  return (
    <div>
      {/* ── Mode chips + stats ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => changeMode(m.id)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold active:scale-[0.96]"
              style={{
                background: mode === m.id
                  ? 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))'
                  : 'var(--color-brand-card)',
                color: mode === m.id ? '#fff' : 'var(--color-brand-muted)',
                border: `1px solid ${mode === m.id ? 'var(--color-brand-cyan)' : 'var(--color-brand-border)'}`,
                transition: 'background-color 120ms ease-out, color 120ms ease-out, transform 100ms ease-out',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

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
        className="rounded-3xl px-4 sm:px-8 py-6 mb-5 relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 120% 90% at 50% -10%, #14724a 0%, #0b4f33 55%, #073d27 100%)',
          border: '1px solid rgba(212, 168, 67, 0.35)',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <p className="text-center text-[10px] font-mono uppercase mb-5"
          style={{ color: 'rgba(212, 168, 67, 0.55)', letterSpacing: '0.35em' }}>
          Blackjack pays 3 to 2
        </p>

        {/* Dealer */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 mb-6">
          <div className="w-16 text-right shrink-0">
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Dealer
            </p>
          </div>
          <div className="flex items-center">
            <PlayingCard key={`d-${scenario.dealerCard.rank}${scenario.dealerCard.suit}-${dealNum}`}
              card={scenario.dealerCard} rotate={-2} delay={0} scale={cardScale} />
            <CardBack key={`db-${dealNum}`} rotate={2} delay={80} overlap scale={cardScale} />
          </div>
          <div className="w-16 shrink-0">
            <span className="inline-block text-xs font-mono font-bold px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.35)', color: 'var(--color-brand-gold)', border: '1px solid rgba(212,168,67,0.4)' }}>
              {DEALER_LABELS[scenario.dealerIdx]}
            </span>
          </div>
        </div>

        {/* Player */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <div className="w-16 text-right shrink-0">
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
              You
            </p>
          </div>
          <div className="flex items-center">
            <PlayingCard key={`p0-${scenario.playerCards[0].rank}${scenario.playerCards[0].suit}-${dealNum}`}
              card={scenario.playerCards[0]} rotate={-3} delay={160} scale={cardScale} />
            <PlayingCard key={`p1-${scenario.playerCards[1].rank}${scenario.playerCards[1].suit}-${dealNum}`}
              card={scenario.playerCards[1]} rotate={3} delay={240} overlap scale={cardScale} />
          </div>
          <div className="w-16 shrink-0">
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap"
              style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
              {scenario.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {['H', 'S', 'D', 'P'].map(a => {
          const meta = ACTION_META[a]
          const splitLocked = a === 'P' && !scenario.isPair
          let bg = `${meta.color}1f`
          let border = `${meta.color}55`
          let color = meta.color
          let opacity = 1
          if (feedback) {
            if (a === scenario.correct) {
              bg = meta.color; color = '#fff'; border = meta.color
            } else if (a === feedback.chosen) {
              bg = 'transparent'; border = 'var(--color-brand-danger)'; color = 'var(--color-brand-danger)'; opacity = 0.9
            } else {
              opacity = 0.3
            }
          } else if (splitLocked) {
            opacity = 0.3
          }
          return (
            <button
              key={a}
              onClick={() => choose(a)}
              disabled={!!feedback || splitLocked}
              className="py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97]"
              style={{
                background: bg,
                border: `1px solid ${border}`,
                color,
                opacity,
                cursor: feedback || splitLocked ? 'default' : 'pointer',
                transition: 'background-color 150ms ease-out, color 150ms ease-out, opacity 150ms ease-out, transform 100ms ease-out',
              }}
            >
              {meta.label}
              <span className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-mono"
                style={{
                  background: feedback && a === scenario.correct ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}>
                {a}
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
                ? `Correct — ${ACTION_META[scenario.correct].label}`
                : `Not quite — the correct play is ${ACTION_META[scenario.correct].label}`}
            </span>
          </div>

          {!feedback.isCorrect && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl" style={{ background: '#1f0a0a' }}>
                <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-brand-danger)' }}>
                  Your play
                </p>
                <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>
                  {ACTION_META[feedback.chosen].label}
                </p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: '#0a1f0a' }}>
                <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-brand-success)' }}>
                  Correct play
                </p>
                <p className="text-sm font-semibold" style={{ color: '#86efac' }}>
                  {ACTION_META[scenario.correct].label}
                </p>
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl"
            style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}>
            <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-brand-muted)' }}>
              House rule {feedback.rule}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-brand-text)' }}>
              {feedback.text}
            </p>
          </div>

          <MiniChartRow scenario={scenario} />

          <button
            onClick={() => nextHand()}
            className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-1"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }}
          >
            Next Hand <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Full chart toggle ── */}
      <div className="mt-2">
        <button
          onClick={() => setShowChart(v => !v)}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg active:scale-[0.97]"
          style={{
            background: 'var(--color-brand-card)',
            border: '1px solid var(--color-brand-border)',
            color: 'var(--color-brand-muted)',
            transition: 'transform 100ms ease-out',
          }}
        >
          <Table2 size={14} />
          {showChart ? 'Hide' : 'View'} full strategy chart
          <ChevronDown size={14}
            style={{ transform: showChart ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease-out' }} />
        </button>
        {showChart && (
          <div className="mt-3 alert-enter">
            <FullChart />
          </div>
        )}
      </div>
    </div>
  )
}
