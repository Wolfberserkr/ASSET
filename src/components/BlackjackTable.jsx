// Playable blackjack simulator for Practice — shoe game with Hi-Lo counting,
// basic-strategy coaching and a mistake log.
//
// Like the rest of Practice this writes NOTHING to the database: no session,
// no score, no cooldown, no adaptive difficulty. The bankroll is play money
// that resets with the page.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  RotateCcw, Layers, AlertTriangle, CheckCircle, XCircle, Eye, EyeOff,
} from 'lucide-react'
import PlayingCard, { CardBack, useFeltScale, FeltLabel } from './PlayingCard'
import {
  CHIPS, DECK_OPTIONS, DEPTH_OPTIONS, DEFAULT_RULES, STARTING_BANKROLL,
  INSURANCE_PAYS, ACTION_NAMES, OUTCOME_LABELS,
  newShoe, cardsLeft, inTray, pastCutCard, hiLo, trueCount, edgeLabel,
  handValue, handLabelOf, describeHand, isBlackjack, isBust, isPair, dealerShouldHit,
  strategyFor, strategyReason, settleHand,
} from '../lib/blackjackGame'

const sleep = ms => new Promise(r => setTimeout(r, ms))

const money = n => `$${Math.round(n).toLocaleString('en-US')}`

// ─── Small presentational pieces ─────────────────────────────────────────────

function StatBox({ label, value, gold = false, small = false }) {
  return (
    <div
      className="flex-1 rounded-xl px-3 py-2.5 text-center"
      style={{
        background: 'var(--color-brand-bg)',
        border: `1px solid ${gold ? 'var(--color-brand-gold-dim)' : 'var(--color-brand-border)'}`,
      }}
    >
      <p className="text-[10px] font-mono uppercase mb-0.5 whitespace-nowrap"
        style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.12em' }}>
        {label}
      </p>
      <p className={small ? 'text-sm font-bold' : 'text-lg font-bold'}
        style={{ color: gold ? 'var(--color-brand-gold)' : 'var(--color-brand-text)' }}>
        {value}
      </p>
    </div>
  )
}

function Toggle({ label, sub, on, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className="flex items-center justify-between gap-3 w-full text-left disabled:opacity-50"
      style={{ cursor: disabled ? 'default' : 'pointer' }}
    >
      <span>
        <span className="block text-xs font-semibold" style={{ color: 'var(--color-brand-text)' }}>
          {label}
        </span>
        {sub && (
          <span className="block text-[11px]" style={{ color: 'var(--color-brand-muted)' }}>
            {sub}
          </span>
        )}
      </span>
      <span
        className="shrink-0 rounded-full relative"
        style={{
          width: 40, height: 22,
          background: on ? 'var(--color-brand-gold)' : 'var(--color-brand-card)',
          border: `1px solid ${on ? 'var(--color-brand-gold)' : 'var(--color-brand-border)'}`,
          transition: 'background-color 150ms ease-out',
        }}
      >
        <span
          className="absolute rounded-full"
          style={{
            width: 16, height: 16, top: 2, left: on ? 21 : 3,
            background: on ? '#fffdf5' : 'var(--color-brand-muted)',
            transition: 'left 150ms ease-out',
          }}
        />
      </span>
    </button>
  )
}

function OptionRow({ label, options, value, onChange, format, disabled }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-mono uppercase mb-1.5"
        style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.12em' }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o}
            onClick={() => !disabled && onChange(o)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 active:scale-[0.96]"
            style={{
              background: o === value ? 'var(--color-brand-gold)' : 'var(--color-brand-bg)',
              color: o === value ? '#1a1405' : 'var(--color-brand-muted)',
              border: `1px solid ${o === value ? 'var(--color-brand-gold)' : 'var(--color-brand-border)'}`,
              transition: 'background-color 120ms ease-out, color 120ms ease-out, transform 100ms ease-out',
            }}
          >
            {format ? format(o) : o}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chip({ chip, onClick, disabled, size = 62 }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full font-bold disabled:opacity-35 active:scale-[0.93] shrink-0"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle at 50% 38%, ${chip.face} 0%, ${chip.edge} 100%)`,
        border: `2px solid ${chip.edge}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.45), inset 0 1px 2px rgba(255,255,255,0.25)',
        color: '#fff',
        fontSize: size * 0.28,
        transition: 'transform 100ms ease-out, opacity 150ms ease-out',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span
        className="flex items-center justify-center rounded-full w-full h-full"
        style={{ border: '2px dashed rgba(255,255,255,0.45)', transform: 'scale(0.78)' }}
      >
        {chip.label}
      </span>
    </button>
  )
}

// Total badge that sits beside a hand on the felt.
function TotalBadge({ cards, dim }) {
  const { total } = handValue(cards)
  const bust = total > 21
  const bj   = isBlackjack(cards)
  const color = bust ? '#fca5a5' : bj ? 'var(--color-brand-gold)' : '#fff'
  return (
    <span
      className="inline-block text-xs font-mono font-bold px-2.5 py-1 rounded-lg whitespace-nowrap"
      style={{
        background: 'rgba(0,0,0,0.4)',
        color,
        border: `1px solid ${bj ? 'rgba(212,168,67,0.5)' : 'rgba(255,255,255,0.2)'}`,
        opacity: dim ? 0.45 : 1,
      }}
    >
      {handLabelOf(cards)}
    </span>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BlackjackTable() {
  const [rules,    setRules]    = useState(DEFAULT_RULES)
  const [bankroll, setBankroll] = useState(STARTING_BANKROLL)
  const [bet,      setBet]      = useState(25)
  const [phase,    setPhase]    = useState('betting') // betting|insurance|playing|dealer|settled
  const [hands,    setHands]    = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [dealer,   setDealer]   = useState([])
  const [holeHidden, setHoleHidden] = useState(true)
  const [message,  setMessage]  = useState('Place your bet to deal')
  const [roundNum, setRoundNum] = useState(0)
  const [insuranceBet, setInsuranceBet] = useState(0)

  const [showHint, setShowHint] = useState(true)
  const [coach,    setCoach]    = useState(false)
  const [countQuiz, setCountQuiz] = useState(false)
  const [revealCount, setRevealCount] = useState(false) // peek while the quiz hides it

  const [coachFlag, setCoachFlag] = useState(null)
  const [mistakes,  setMistakes]  = useState([])
  const [stats, setStats] = useState({
    rounds: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0,
  })
  const [quiz, setQuiz] = useState(null) // { input, result }
  const [quizStats, setQuizStats] = useState({ asked: 0, right: 0 })

  // The shoe is mutated in place through a ref so the dealer's draw loop always
  // reads the current position; `shoeInfo` mirrors it for rendering.
  const shoeRef    = useRef(newShoe(DEFAULT_RULES))
  const runningRef = useRef(0)
  const holeRef    = useRef(null)   // hole card's count value, deferred until reveal
  const busyRef    = useRef(false)  // blocks input while the dealer acts

  const [shoeInfo, setShoeInfo] = useState(() => ({
    left: cardsLeft(shoeRef.current),
    tray: inTray(shoeRef.current),
    cut:  shoeRef.current.cut,
    size: shoeRef.current.cards.length,
    running: 0,
  }))

  const syncShoe = useCallback(() => {
    const s = shoeRef.current
    setShoeInfo({
      left: cardsLeft(s), tray: inTray(s), cut: s.cut,
      size: s.cards.length, running: runningRef.current,
    })
  }, [])

  // Rebuild the shoe whenever the deck count or deal depth changes.
  const reshuffle = useCallback((r) => {
    shoeRef.current = newShoe(r)
    runningRef.current = 0
    holeRef.current = null
    syncShoe()
  }, [syncShoe])

  const changeRules = (patch) => {
    const next = { ...rules, ...patch }
    setRules(next)
    if (patch.decks != null || patch.depth != null) {
      reshuffle(next)
      setMessage('Shoe reshuffled — place your bet')
    }
  }

  // Draws one card. A face-down card's count is held back until it is turned up.
  const draw = useCallback((faceUp = true) => {
    const s = shoeRef.current
    const card = s.cards[s.pos]
    s.pos += 1
    if (faceUp) runningRef.current += hiLo(card.rank)
    else holeRef.current = hiLo(card.rank)
    return card
  }, [])

  const revealHole = useCallback(() => {
    if (holeRef.current != null) {
      runningRef.current += holeRef.current
      holeRef.current = null
    }
    setHoleHidden(false)
    syncShoe()
  }, [syncShoe])

  const tc = trueCount(shoeInfo.running, shoeInfo.left)
  const countHidden = countQuiz && !revealCount

  // ── Betting ────────────────────────────────────────────────────
  const addChip = (v) => {
    if (phase !== 'betting') return
    if (bet + v > bankroll) return
    setBet(b => b + v)
  }

  const canDeal = phase === 'betting' && bet > 0 && bet <= bankroll && !quiz

  const deal = async () => {
    if (!canDeal || busyRef.current) return
    busyRef.current = true

    // Cut card reached during the last round — shuffle up before dealing.
    if (pastCutCard(shoeRef.current)) {
      reshuffle(rules)
      setMessage('Cut card reached — new shoe')
      await sleep(400)
    }

    setCoachFlag(null)
    setInsuranceBet(0)
    setHoleHidden(true)
    setRoundNum(n => n + 1)

    const p1 = draw()
    const d1 = draw()
    const p2 = draw()
    const d2 = draw(false) // hole card

    const playerHand = {
      cards: [p1, p2], bet, fromSplit: false,
      doubled: false, surrendered: false, done: false,
    }
    setHands([playerHand])
    setActiveIdx(0)
    setDealer([d1, d2])
    syncShoe()

    const playerBJ = isBlackjack([p1, p2])

    // Dealer peeks on an Ace or a ten — insurance is offered on the Ace first.
    if (d1.rank === 'A') {
      setPhase('insurance')
      setMessage('Insurance?')
      busyRef.current = false
      return
    }

    if (handValue([d1]).total === 10 && isBlackjack([d1, d2])) {
      setMessage('Dealer has blackjack')
      busyRef.current = false
      await finishRound([playerHand], [d1, d2], 0)
      return
    }

    if (playerBJ) {
      setMessage('Blackjack!')
      busyRef.current = false
      await finishRound([playerHand], [d1, d2], 0)
      return
    }

    setPhase('playing')
    setMessage('Your move')
    busyRef.current = false
  }

  // ── Insurance ──────────────────────────────────────────────────
  const answerInsurance = async (take) => {
    if (busyRef.current) return
    busyRef.current = true
    const stake = take ? Math.floor(bet / 2) : 0

    if (take && coach) {
      // Basic strategy never insures — the bet only turns profitable when the
      // count says the shoe is ten-rich, which is a counter's play, not a
      // basic-strategy one.
      flagMistake({
        hand: 'Insurance', dealerUp: 'A', chosen: 'Insurance', correct: 'Decline',
        reason: 'Basic strategy never takes insurance. It only becomes a positive bet at a high true count — taking it flat is a house-edge play.',
      })
    }

    setInsuranceBet(stake)
    const d = dealer
    const dealerBJ = isBlackjack(d)

    if (dealerBJ) {
      revealHole()
      setMessage(stake > 0 ? 'Dealer blackjack — insurance pays' : 'Dealer has blackjack')
      busyRef.current = false
      await finishRound(hands, d, stake > 0 ? stake * INSURANCE_PAYS - stake : -stake)
      return
    }

    if (stake > 0) setMessage('No dealer blackjack — insurance lost')

    if (isBlackjack(hands[0].cards)) {
      busyRef.current = false
      await finishRound(hands, d, -stake)
      return
    }

    setPhase('playing')
    if (stake === 0) setMessage('Your move')
    busyRef.current = false
  }

  // ── Coach ──────────────────────────────────────────────────────
  const flagMistake = (m) => {
    setCoachFlag(m)
    setMistakes(list => [{ ...m, id: Date.now() + Math.random() }, ...list].slice(0, 25))
  }

  const currentHand = hands[activeIdx] ?? null

  const legal = useMemo(() => {
    if (phase !== 'playing' || !currentHand) {
      return { hit: false, stand: false, double: false, split: false, surrender: false }
    }
    const c = currentHand.cards
    const first = c.length === 2 && !currentHand.doubled
    return {
      hit:    !isBust(c) && handValue(c).total < 21,
      stand:  true,
      double: first && bankroll >= currentHand.bet
        && (!currentHand.fromSplit || rules.das),
      split:  first && isPair(c) && hands.length < rules.resplitTo
        && bankroll >= currentHand.bet,
      surrender: first && !currentHand.fromSplit && rules.surrender && hands.length === 1,
    }
  }, [phase, currentHand, hands.length, bankroll, rules])

  const hint = useMemo(() => {
    if (phase !== 'playing' || !currentHand || !dealer[0]) return null
    return strategyFor(currentHand.cards, dealer[0].rank, {
      canDouble:    legal.double,
      canSplit:     legal.split,
      canSurrender: legal.surrender,
      hitSoft17:    rules.hitSoft17,
    })
  }, [phase, currentHand, dealer, legal, rules.hitSoft17])

  // ── Player actions ─────────────────────────────────────────────
  const act = async (action) => {
    if (phase !== 'playing' || busyRef.current || !currentHand) return
    if (action === 'H' && !legal.hit) return
    if (action === 'D' && !legal.double) return
    if (action === 'P' && !legal.split) return
    if (action === 'R' && !legal.surrender) return

    busyRef.current = true
    setCoachFlag(null)

    if (coach && hint && action !== hint) {
      flagMistake({
        hand: describeHand(currentHand.cards),
        dealerUp: dealer[0].rank,
        chosen: ACTION_NAMES[action],
        correct: ACTION_NAMES[hint],
        reason: strategyReason(currentHand.cards, dealer[0].rank, hint),
      })
    }

    let next = hands.map(h => ({ ...h, cards: [...h.cards] }))
    const h = next[activeIdx]

    if (action === 'R') {
      h.surrendered = true
      h.done = true
    } else if (action === 'S') {
      h.done = true
    } else if (action === 'H') {
      h.cards.push(draw())
      if (handValue(h.cards).total >= 21) h.done = true
    } else if (action === 'D') {
      h.bet *= 2
      h.doubled = true
      h.cards.push(draw())
      h.done = true
    } else if (action === 'P') {
      const [c1, c2] = h.cards
      const wasAces = c1.rank === 'A'
      const left  = { ...h, cards: [c1, draw()], fromSplit: true, done: false }
      const right = { ...h, cards: [c2, draw()], fromSplit: true, done: false }
      // Split aces get one card each and stand — house rule.
      if (wasAces) { left.done = true; right.done = true }
      next.splice(activeIdx, 1, left, right)
    }

    setHands(next)
    syncShoe()
    await sleep(160)

    // Advance to the next unfinished hand, or turn it over to the dealer.
    const nextIdx = next.findIndex((x, i) => i >= activeIdx && !x.done)
    if (nextIdx !== -1) {
      setActiveIdx(nextIdx)
      setMessage(next.length > 1 ? `Hand ${nextIdx + 1} of ${next.length}` : 'Your move')
      busyRef.current = false
      return
    }

    busyRef.current = false
    await runDealer(next)
  }

  // ── Dealer turn ────────────────────────────────────────────────
  const runDealer = async (finalHands) => {
    busyRef.current = true
    setPhase('dealer')
    setMessage('Dealer plays')
    await sleep(300)
    revealHole()
    await sleep(500)

    let dcards = [...dealer]
    // The dealer only draws when a live hand is still out there.
    const live = finalHands.some(h => !h.surrendered && !isBust(h.cards))
    if (live) {
      while (dealerShouldHit(dcards, rules.hitSoft17)) {
        const c = draw()
        dcards = [...dcards, c]
        setDealer(dcards)
        syncShoe()
        await sleep(550)
      }
    }
    busyRef.current = false
    await finishRound(finalHands, dcards, 0)
  }

  // ── Settlement ─────────────────────────────────────────────────
  const finishRound = async (finalHands, dcards, insuranceNet) => {
    revealHole()
    const settled = finalHands.map(h => ({ ...h, ...settleHand(h, dcards, rules) }))
    const net = settled.reduce((s, h) => s + h.net, 0) + insuranceNet

    setHands(settled)
    setDealer(dcards)
    setBankroll(b => b + net)
    setPhase('settled')

    setStats(s => {
      const wins   = settled.filter(h => h.outcome === 'win' || h.outcome === 'blackjack').length
      const losses = settled.filter(h => h.outcome === 'lose' || h.outcome === 'bust' || h.outcome === 'surrender').length
      const pushes = settled.filter(h => h.outcome === 'push').length
      const bjs    = settled.filter(h => h.outcome === 'blackjack').length
      return {
        rounds: s.rounds + 1,
        wins: s.wins + wins,
        losses: s.losses + losses,
        pushes: s.pushes + pushes,
        blackjacks: s.blackjacks + bjs,
      }
    })

    const summary = settled.length === 1
      ? `${OUTCOME_LABELS[settled[0].outcome]}${net !== 0 ? ` ${net > 0 ? '+' : '−'}${money(Math.abs(net))}` : ''}`
      : `${net > 0 ? '+' : net < 0 ? '−' : ''}${money(Math.abs(net))} on ${settled.length} hands`
    setMessage(summary)
    syncShoe()
  }

  // ── Next round / count quiz ────────────────────────────────────
  const nextRound = () => {
    if (busyRef.current) return
    setCoachFlag(null)
    setHands([])
    setDealer([])
    setHoleHidden(true)
    setInsuranceBet(0)
    setRevealCount(false)
    setBet(b => Math.max(0, Math.min(b, bankroll)))

    // Roughly one round in four, the quiz stops play and asks for the count.
    if (countQuiz && Math.random() < 0.25 && stats.rounds > 0) {
      setQuiz({ input: '', result: null })
      setMessage('Count check')
    } else {
      setMessage('Place your bet to deal')
    }
    setPhase('betting')
  }

  const submitQuiz = () => {
    const given = parseInt(quiz.input, 10)
    if (isNaN(given)) return
    const right = given === runningRef.current
    setQuiz(q => ({ ...q, result: { right, actual: runningRef.current } }))
    setQuizStats(s => ({ asked: s.asked + 1, right: s.right + (right ? 1 : 0) }))
  }

  // ── Keyboard ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      if (phase === 'betting' && !quiz) {
        if (k === ' ' || k === 'enter') { e.preventDefault(); deal() }
        return
      }
      if (phase === 'settled') {
        if (k === ' ' || k === 'enter' || k === 'n') { e.preventDefault(); nextRound() }
        return
      }
      if (phase === 'playing') {
        if (k === 'h') act('H')
        else if (k === 's') act('S')
        else if (k === 'd') act('D')
        else if (k === 'p') act('P')
        else if (k === 'r') act('R')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, quiz, deal, nextRound, act])

  // ── Derived display ────────────────────────────────────────────
  const dealt = hands.length > 0 || dealer.length > 0
  const maxCards = Math.max(2, ...hands.map(h => h.cards.length), dealer.length)
  const [feltRef, baseScale] = useFeltScale(maxCards, 1.35)
  const cardScale = hands.length > 1 ? baseScale * 0.62 : baseScale

  const dealtPct = shoeInfo.size > 0
    ? Math.min(100, Math.round((shoeInfo.tray / shoeInfo.size) * 100))
    : 0
  const cutPct = shoeInfo.size > 0 ? (shoeInfo.cut / shoeInfo.size) * 100 : 75

  const decided = stats.wins + stats.losses + stats.pushes
  const winRate = decided > 0 ? Math.round((stats.wins / decided) * 100) : 0
  const edgePct = Math.max(-5, Math.min(5, tc))

  const resetSession = () => {
    setStats({ rounds: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0 })
    setMistakes([])
    setQuizStats({ asked: 0, right: 0 })
    setBankroll(STARTING_BANKROLL)
    reshuffle(rules)
    setMessage('Session reset — place your bet')
  }

  const panel = {
    background: 'var(--color-brand-card)',
    border: '1px solid var(--color-brand-border)',
  }

  return (
    <div>
      {/* ── Shoe / discard / bankroll ── */}
      <div className="flex gap-2 mb-3">
        <StatBox label="Shoe" value={shoeInfo.left} />
        <StatBox label="Discard" value={shoeInfo.tray} />
        <StatBox label="Bankroll" value={money(bankroll)} gold />
      </div>

      {/* ── Shoe bar with cut card ── */}
      <div className="rounded-2xl px-4 py-3 mb-3" style={panel}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-2.5">
          <span className="text-[11px] font-mono uppercase" style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.1em' }}>
            Shoe — <span style={{ color: 'var(--color-brand-text)' }}>{shoeInfo.left}</span> cards
          </span>
          <span className="text-[11px] font-mono uppercase" style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.1em' }}>
            {Math.round(rules.depth * 100)}% deal depth
          </span>
          <span className="text-[11px] font-mono uppercase" style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.1em' }}>
            <span style={{ color: 'var(--color-brand-text)' }}>{shoeInfo.tray}</span> in tray
          </span>
        </div>
        <div className="relative h-2 rounded-full" style={{ background: 'var(--color-brand-bg)' }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${dealtPct}%`,
              background: 'linear-gradient(90deg, var(--color-brand-grad-a), var(--color-brand-grad-b))',
              transition: 'width 300ms ease-out',
            }}
          />
          <div
            className="absolute"
            style={{
              left: `${cutPct}%`, top: -5, width: 3, height: 18, borderRadius: 2,
              background: 'var(--color-brand-gold)',
              boxShadow: '0 0 6px rgba(212,168,67,0.8)',
            }}
          />
        </div>
        <p className="text-[10px] text-right mt-1.5" style={{ color: 'var(--color-brand-gold)' }}>
          Cut card
        </p>
      </div>

      {/* ── Count panel ── */}
      <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-2" style={panel}>
        <div className="flex-1 text-center">
          <p className="text-[10px] font-mono uppercase mb-0.5" style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.1em' }}>
            Running count
          </p>
          <p className="text-2xl font-bold" style={{ color: countHidden ? 'var(--color-brand-muted)' : 'var(--color-brand-text)' }}>
            {countHidden ? '??' : (shoeInfo.running > 0 ? `+${shoeInfo.running}` : shoeInfo.running)}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--color-brand-muted)' }}>Hi-Lo</p>
        </div>

        <div className="w-px self-stretch" style={{ background: 'var(--color-brand-border)' }} />

        <div className="flex-1 text-center">
          <p className="text-[10px] font-mono uppercase mb-0.5" style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.1em' }}>
            True count
          </p>
          <p className="text-2xl font-bold" style={{ color: countHidden ? 'var(--color-brand-muted)' : 'var(--color-brand-text)' }}>
            {countHidden ? '??' : (tc > 0 ? `+${tc.toFixed(1)}` : tc.toFixed(1))}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--color-brand-muted)' }}>
            {(shoeInfo.left / 52).toFixed(1)} decks left
          </p>
        </div>

        <div className="w-px self-stretch" style={{ background: 'var(--color-brand-border)' }} />

        <div className="flex-1 text-center">
          <p className="text-[10px] font-mono uppercase mb-1.5" style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.1em' }}>
            Edge
          </p>
          <div className="relative h-1.5 rounded-full mx-2" style={{ background: 'var(--color-brand-bg)' }}>
            {!countHidden && (
              <div
                className="absolute rounded-full"
                style={{
                  left: `calc(${((edgePct + 5) / 10) * 100}% - 2px)`, top: -3, width: 4, height: 12,
                  background: tc >= 1 ? 'var(--color-brand-success)' : tc <= -2 ? 'var(--color-brand-danger)' : 'var(--color-brand-muted)',
                  transition: 'left 300ms ease-out',
                }}
              />
            )}
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-brand-muted)' }}>
            {countHidden ? '—' : edgeLabel(tc)}
          </p>
        </div>

        {countQuiz && (
          <button
            onClick={() => setRevealCount(v => !v)}
            className="p-2 rounded-lg shrink-0 active:scale-[0.95]"
            style={{ color: 'var(--color-brand-muted)', border: '1px solid var(--color-brand-border)' }}
            title={revealCount ? 'Hide count' : 'Peek at count'}
          >
            {revealCount ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>

      {/* ── Felt ── */}
      <div
        ref={feltRef}
        className="rounded-3xl px-4 sm:px-8 py-6 mb-4 relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 120% 90% at 50% -10%, #14724a 0%, #0b4f33 55%, #073d27 100%)',
          border: '1px solid rgba(212, 168, 67, 0.35)',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.3)',
          minHeight: dealt ? 340 : 200,
        }}
      >
        {/* Dealer */}
        <div className={`flex items-center justify-center gap-3 sm:gap-5 mb-4 ${dealt ? 'min-h-[130px]' : ''}`}>
          <div className="w-16 sm:w-20 flex justify-end shrink-0">
            <FeltLabel>Dealer</FeltLabel>
          </div>
          <div className="flex items-center justify-center" style={{ minWidth: 90 }}>
            {dealer.map((c, i) => (
              i === 1 && holeHidden
                ? <CardBack key={`dh-${roundNum}`} rotate={2} delay={80} overlap scale={cardScale} />
                : <PlayingCard key={`d${i}-${roundNum}`} card={c} rotate={i % 2 ? 2 : -2}
                    delay={i * 80} overlap={i > 0} scale={cardScale} />
            ))}
          </div>
          <div className="w-16 sm:w-20 shrink-0">
            {dealer.length > 0 && !holeHidden && <TotalBadge cards={dealer} />}
            {dealer.length > 0 && holeHidden && (
              <span className="inline-block text-xs font-mono font-bold px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--color-brand-gold)', border: '1px solid rgba(212,168,67,0.4)' }}>
                {handValue([dealer[0]]).total}
              </span>
            )}
          </div>
        </div>

        {/* Rule banner + message */}
        <div className="text-center my-4">
          <p className="text-sm font-semibold" style={{ color: 'rgba(212, 168, 67, 0.9)', fontStyle: 'italic' }}>
            Blackjack pays 3 to 2
          </p>
          <p className="text-[10px] font-mono uppercase mt-1" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
            Dealer must {rules.hitSoft17 ? 'hit' : 'stand on'} soft 17 · Insurance pays 2 to 1
          </p>
          <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {message}
          </p>
        </div>

        {/* Player hands */}
        <div className={`flex items-start justify-center gap-3 sm:gap-5 ${dealt ? 'min-h-[130px]' : ''}`}>
          <div className="w-16 sm:w-20 flex justify-end shrink-0 pt-4">
            {hands.length > 0 && <FeltLabel>You</FeltLabel>}
          </div>
          <div className="flex items-start justify-center gap-4 flex-wrap" style={{ minWidth: 90 }}>
            {hands.map((h, hi) => {
              const active = phase === 'playing' && hi === activeIdx
              return (
                <div
                  key={`h${hi}-${roundNum}`}
                  className="flex flex-col items-center gap-2 rounded-2xl px-2 py-2"
                  style={{
                    border: active ? '1px solid rgba(212,168,67,0.7)' : '1px solid transparent',
                    background: active ? 'rgba(212,168,67,0.07)' : 'transparent',
                    opacity: h.surrendered ? 0.45 : 1,
                    transition: 'border-color 150ms ease-out, background-color 150ms ease-out',
                  }}
                >
                  <div className="flex items-center">
                    {h.cards.map((c, i) => (
                      <PlayingCard key={`h${hi}c${i}-${roundNum}`} card={c}
                        rotate={i % 2 ? 3 : -3} delay={120 + i * 80} overlap={i > 0} scale={cardScale} />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <TotalBadge cards={h.cards} dim={h.surrendered} />
                    <span className="text-[11px] font-mono px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--color-brand-gold)', border: '1px solid rgba(212,168,67,0.35)' }}>
                      {money(h.bet)}{h.doubled ? ' ×2' : ''}
                    </span>
                  </div>
                  {h.outcome && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
                      style={{
                        background: 'rgba(0,0,0,0.45)',
                        color: h.net > 0 ? '#86efac' : h.net < 0 ? '#fca5a5' : 'rgba(255,255,255,0.7)',
                      }}>
                      {OUTCOME_LABELS[h.outcome]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="w-16 sm:w-20 shrink-0" />
        </div>

        {insuranceBet > 0 && (
          <p className="text-center text-[11px] font-mono mt-3" style={{ color: 'rgba(212,168,67,0.8)' }}>
            Insurance {money(insuranceBet)}
          </p>
        )}
      </div>

      {/* ── Coach flag ── */}
      {coachFlag && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-4 alert-enter"
          style={{ background: '#1f0a0a', border: '1px solid var(--color-brand-danger)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--color-brand-danger)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: '#fca5a5' }}>
              You played {coachFlag.chosen} — the chart says {coachFlag.correct}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-brand-muted)' }}>
              {coachFlag.reason}
            </p>
          </div>
        </div>
      )}

      {/* ── Count quiz prompt ── */}
      {quiz && (
        <div className="rounded-2xl px-4 py-4 mb-4 alert-enter"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-gold-dim)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-brand-gold)' }}>
            Count check
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-brand-muted)' }}>
            What is the Hi-Lo running count right now?
          </p>
          {quiz.result ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                {quiz.result.right
                  ? <CheckCircle size={18} style={{ color: 'var(--color-brand-success)' }} />
                  : <XCircle size={18} style={{ color: 'var(--color-brand-danger)' }} />}
                <span className="text-sm font-semibold"
                  style={{ color: quiz.result.right ? 'var(--color-brand-success)' : '#fca5a5' }}>
                  {quiz.result.right
                    ? `Correct — the count is ${quiz.result.actual > 0 ? '+' : ''}${quiz.result.actual}`
                    : `The running count is ${quiz.result.actual > 0 ? '+' : ''}${quiz.result.actual}`}
                </span>
              </div>
              <button
                onClick={() => { setQuiz(null); setMessage('Place your bet to deal') }}
                className="w-full py-3 rounded-xl font-semibold text-sm"
                style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }}
              >
                Continue
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={quiz.input}
                onChange={e => setQuiz(q => ({ ...q, input: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && submitQuiz()}
                placeholder="e.g. -3"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono"
                style={{
                  background: 'var(--color-brand-bg)',
                  border: '1px solid var(--color-brand-border)',
                  color: 'var(--color-brand-text)',
                }}
              />
              <button
                onClick={submitQuiz}
                className="px-5 rounded-xl font-semibold text-sm"
                style={{ background: 'var(--color-brand-gold)', color: '#1a1405' }}
              >
                Check
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Insurance prompt ── */}
      {phase === 'insurance' && (
        <div className="rounded-2xl px-4 py-4 mb-4"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-gold-dim)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-brand-gold)' }}>
            Dealer shows an Ace
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-brand-muted)' }}>
            Insurance costs {money(Math.floor(bet / 2))} and pays 2 to 1 if the dealer has blackjack.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => answerInsurance(true)}
              className="py-3 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--color-brand-gold)', color: '#1a1405' }}>
              Take insurance
            </button>
            <button onClick={() => answerInsurance(false)}
              className="py-3 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
              No insurance
            </button>
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      {phase === 'playing' && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
          {[
            { a: 'H', ok: legal.hit,       color: '#22c55e' },
            { a: 'S', ok: legal.stand,     color: '#ef4444' },
            { a: 'D', ok: legal.double,    color: '#4fa8ff' },
            { a: 'P', ok: legal.split,     color: '#f59e0b' },
            { a: 'R', ok: legal.surrender, color: '#94a3b8' },
          ].map(({ a, ok, color }) => {
            const isHint = showHint && hint === a
            return (
              <button
                key={a}
                onClick={() => act(a)}
                disabled={!ok}
                className="py-3.5 rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-0.5 active:scale-[0.97]"
                style={{
                  background: isHint ? color : `${color}1f`,
                  border: `1px solid ${isHint ? color : `${color}55`}`,
                  color: isHint ? '#0b0d14' : color,
                  opacity: ok ? 1 : 0.28,
                  cursor: ok ? 'pointer' : 'default',
                  transition: 'background-color 150ms ease-out, opacity 150ms ease-out, transform 100ms ease-out',
                }}
              >
                {ACTION_NAMES[a]}
                <span className="text-[10px] font-mono opacity-70">{a}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Betting / next round ── */}
      {(phase === 'betting' || phase === 'settled') && (
        <div className="rounded-2xl px-4 py-4 mb-4" style={panel}>
          {phase === 'betting' && !quiz && (
            <>
              <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
                {CHIPS.map(c => (
                  <Chip key={c.value} chip={c} onClick={() => addChip(c.value)}
                    disabled={bet + c.value > bankroll} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl px-4 py-2.5 text-center shrink-0"
                  style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-gold-dim)' }}>
                  <p className="text-[10px] font-mono uppercase" style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.1em' }}>
                    Bet
                  </p>
                  <p className="text-lg font-bold" style={{ color: 'var(--color-brand-gold)' }}>{money(bet)}</p>
                </div>
                <button
                  onClick={() => setBet(0)}
                  className="px-4 py-3 rounded-xl text-sm font-semibold shrink-0 active:scale-[0.97]"
                  style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}
                >
                  Clear
                </button>
                <button
                  onClick={deal}
                  disabled={!canDeal}
                  className="flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98]"
                  style={{ background: 'var(--color-brand-gold)', color: '#1a1405' }}
                >
                  Deal
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,0,0,0.2)' }}>Space</span>
                </button>
              </div>
            </>
          )}

          {phase === 'settled' && (
            <button
              onClick={nextRound}
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{ background: 'var(--color-brand-gold)', color: '#1a1405' }}
            >
              Next Hand
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>Space</span>
            </button>
          )}

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4"
            style={{ borderTop: '1px solid var(--color-brand-border)' }}>
            <Toggle label="Strategy hint" sub="Highlights the play" on={showHint} onChange={setShowHint} />
            <Toggle label="Coach mode" sub="Flags your mistakes" on={coach} onChange={setCoach} />
            <Toggle label="Count quiz" sub="Hides the count" on={countQuiz} onChange={setCountQuiz} />
          </div>
        </div>
      )}

      {/* ── Table rules ── */}
      <div className="rounded-2xl px-4 py-4 mb-4" style={panel}>
        <p className="text-sm font-bold mb-3" style={{ color: 'var(--color-brand-gold)' }}>
          Table Rules
        </p>
        <OptionRow label="Decks" options={DECK_OPTIONS} value={rules.decks}
          onChange={v => changeRules({ decks: v })} disabled={phase !== 'betting' && phase !== 'settled'} />
        <OptionRow label="Deal depth" options={DEPTH_OPTIONS} value={rules.depth}
          format={v => `${Math.round(v * 100)}%`}
          onChange={v => changeRules({ depth: v })} disabled={phase !== 'betting' && phase !== 'settled'} />
        <p className="text-[11px] mb-4 -mt-1" style={{ color: 'var(--color-brand-muted)' }}>
          Cards dealt before reshuffling (default 75%)
        </p>

        <div className="flex flex-col gap-3">
          <Toggle label="Dealer hits soft 17" sub={rules.hitSoft17 ? 'H17' : 'S17'}
            on={rules.hitSoft17} onChange={v => changeRules({ hitSoft17: v })} />
          <div style={{ borderTop: '1px solid var(--color-brand-border)' }} />
          <Toggle label="Double after split" sub={rules.das ? 'DAS allowed' : 'No DAS'}
            on={rules.das} onChange={v => changeRules({ das: v })} />
          <div style={{ borderTop: '1px solid var(--color-brand-border)' }} />
          <Toggle label="Late surrender" sub="Offered on the first two cards"
            on={rules.surrender} onChange={v => changeRules({ surrender: v })} />
        </div>
      </div>

      {/* ── Session ── */}
      <div className="rounded-2xl px-4 py-4 mb-4" style={panel}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold" style={{ color: 'var(--color-brand-gold)' }}>Session</p>
          <button onClick={resetSession}
            className="flex items-center gap-1.5 text-xs active:scale-[0.96]"
            style={{ color: 'var(--color-brand-muted)' }}>
            <RotateCcw size={12} /> Reset
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <StatBox label="Rounds" value={stats.rounds} small />
          <StatBox label="Wins" value={stats.wins} small />
          <StatBox label="Losses" value={stats.losses} small />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatBox label="Pushes" value={stats.pushes} small />
          <StatBox label="Blackjacks" value={stats.blackjacks} small />
          <StatBox label="Win rate" value={`${winRate}%`} small />
        </div>

        {quizStats.asked > 0 && (
          <div className="rounded-xl px-3 py-2.5 mb-4"
            style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-gold-dim)' }}>
            <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
              Count checks:{' '}
              <span style={{ color: 'var(--color-brand-gold)' }}>
                {quizStats.right} / {quizStats.asked}
              </span>
            </p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs mb-1.5">
          <span style={{ color: 'var(--color-brand-muted)' }}>Shoe penetration</span>
          <span style={{ color: 'var(--color-brand-text)' }}>{dealtPct}%</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: 'var(--color-brand-bg)' }}>
          <div className="h-full rounded-full"
            style={{
              width: `${dealtPct}%`,
              background: 'linear-gradient(90deg, var(--color-brand-grad-a), var(--color-brand-grad-b))',
              transition: 'width 300ms ease-out',
            }} />
        </div>
        <p className="text-[11px] text-right mt-1" style={{ color: 'var(--color-brand-muted)' }}>
          {shoeInfo.left} cards left
        </p>
      </div>

      {/* ── Mistake log ── */}
      <div className="rounded-2xl px-4 py-4 mb-4" style={panel}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-brand-gold)' }}>
            <Layers size={14} /> Mistake Log
          </p>
          <span className="text-xs font-mono px-2 py-0.5 rounded-lg"
            style={{ background: 'var(--color-brand-bg)', color: 'var(--color-brand-muted)', border: '1px solid var(--color-brand-border)' }}>
            {mistakes.length}
          </span>
        </div>
        {mistakes.length === 0 ? (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-brand-muted)' }}>
            Turn on Coach mode and play — your deviations from basic strategy will appear here.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {mistakes.map(m => (
              <div key={m.id} className="rounded-xl px-3 py-2.5"
                style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--color-brand-text)' }}>
                  {m.hand} vs dealer {m.dealerUp} —{' '}
                  <span style={{ color: 'var(--color-brand-danger)' }}>{m.chosen}</span>
                  {' → '}
                  <span style={{ color: 'var(--color-brand-success)' }}>{m.correct}</span>
                </p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-brand-muted)' }}>
                  {m.reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-center leading-relaxed px-4" style={{ color: 'var(--color-brand-muted)' }}>
        Strategy hints follow the house basic strategy chart — changing the table rules changes the
        game, not the chart. Running and true counts use the Hi-Lo system. Count-based play
        deviations are not shown. Play money only; nothing here is recorded.
      </p>
    </div>
  )
}
