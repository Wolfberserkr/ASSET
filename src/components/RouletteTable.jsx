// Playable roulette table for Practice — animated wheel, full betting layout,
// and a payout-verification mode.
//
// The training point is the verify step: the ball lands, and before the table
// pays, the agent computes what the spread owes. That is the floor skill.
//
// Like the rest of Practice this writes NOTHING to the database: no session,
// no score, no cooldown. The bankroll is play money that resets with the page.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  RotateCcw, Undo2, Trash2, AlertTriangle, CheckCircle, XCircle, ListOrdered, ChevronDown,
} from 'lucide-react'
import RouletteWheel from './RouletteWheel'
import {
  ZW, CW, CH, GRID_W, RED_NUMS, PAYOUTS, BET_TYPE_LABELS,
  buildBetSpots, settleSpin, spin, colorOf, cellOf, tallyHistory, key,
} from '../lib/rouletteGame'
import { loadRoulettePrefs, saveRoulettePrefs } from '../lib/roulettePrefs'

const SVG_W = ZW + GRID_W + 40
const SVG_H = CH * 3 + 40 + 40

const STARTING_BANKROLL = 5000

// Chip tray — the casino's chip set (CLAUDE.md). $1 and $5 lead because the
// payout drills randomise on White and Red.
const CHIPS = [
  { value: 1,   label: '1',   face: '#f1f0e8', edge: '#b9b7ab', text: '#1b1b18' },
  { value: 5,   label: '5',   face: '#c1272d', edge: '#8c1b20', text: '#fff' },
  { value: 25,  label: '25',  face: '#16875a', edge: '#0e5c3d', text: '#fff' },
  { value: 100, label: '100', face: '#15192b', edge: '#0a0d18', text: '#fff' },
  { value: 500, label: '500', face: '#6d28d9', edge: '#4c1d95', text: '#fff' },
]

const money = n => `$${Number(n).toLocaleString('en-US')}`

// ─── Small pieces ─────────────────────────────────────────────────────────────

function StatBox({ label, value, gold, color }) {
  return (
    <div className="flex-1 rounded-xl px-3 py-2.5 text-center min-w-0"
      style={{ background: 'var(--color-brand-bg)', border: `1px solid ${gold ? 'var(--color-brand-gold-dim)' : 'var(--color-brand-border)'}` }}>
      <p className="text-[10px] font-mono uppercase mb-0.5 truncate"
        style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.12em' }}>{label}</p>
      <p className="text-lg font-bold truncate"
        style={{ color: color ?? (gold ? 'var(--color-brand-gold)' : 'var(--color-brand-text)') }}>{value}</p>
    </div>
  )
}

function Toggle({ label, sub, on, onChange, disabled }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} disabled={disabled}
      className="flex items-center justify-between gap-3 w-full text-left disabled:opacity-50"
      style={{ cursor: disabled ? 'default' : 'pointer' }}>
      <span>
        <span className="block text-xs font-semibold" style={{ color: 'var(--color-brand-text)' }}>{label}</span>
        {sub && <span className="block text-[11px]" style={{ color: 'var(--color-brand-muted)' }}>{sub}</span>}
      </span>
      <span className="shrink-0 rounded-full relative"
        style={{ width: 40, height: 22, background: on ? 'var(--color-brand-gold)' : 'var(--color-brand-card)',
          border: `1px solid ${on ? 'var(--color-brand-gold)' : 'var(--color-brand-border)'}`,
          transition: 'background-color 150ms ease-out' }}>
        <span className="absolute rounded-full"
          style={{ width: 16, height: 16, top: 2, left: on ? 21 : 3,
            background: on ? '#fffdf5' : 'var(--color-brand-muted)', transition: 'left 150ms ease-out' }} />
      </span>
    </button>
  )
}

function Chip({ chip, selected, onClick, disabled }) {
  const size = 54
  return (
    <button onClick={onClick} disabled={disabled}
      className="rounded-full font-bold disabled:opacity-35 active:scale-[0.93] shrink-0"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle at 50% 38%, ${chip.face} 0%, ${chip.edge} 100%)`,
        border: `2px solid ${selected ? 'var(--color-brand-gold)' : chip.edge}`,
        boxShadow: selected
          ? '0 0 0 2px var(--color-brand-gold), 0 4px 12px rgba(0,0,0,0.45)'
          : '0 4px 12px rgba(0,0,0,0.45), inset 0 1px 2px rgba(255,255,255,0.25)',
        color: chip.text, fontSize: size * 0.28,
        transform: selected ? 'translateY(-3px)' : 'none',
        transition: 'transform 120ms ease-out, box-shadow 150ms ease-out',
      }}>
      <span className="flex items-center justify-center rounded-full w-full h-full"
        style={{ border: '2px dashed rgba(255,255,255,0.4)', transform: 'scale(0.78)' }}>
        {chip.label}
      </span>
    </button>
  )
}

// A stack of wagered chips drawn on the layout.
function TableChip({ x, y, amount, won, settled }) {
  const c = [...CHIPS].reverse().find(ch => amount >= ch.value) ?? CHIPS[0]
  const dim = settled && !won
  return (
    <g style={{ pointerEvents: 'none', opacity: dim ? 0.3 : 1, transition: 'opacity 250ms ease-out' }}>
      <circle cx={x} cy={y + 1.5} r={11} fill="rgba(0,0,0,0.45)" />
      <circle cx={x} cy={y} r={11} fill={c.face} stroke={won && settled ? 'var(--color-brand-gold)' : c.edge}
        strokeWidth={won && settled ? 2 : 1.5} />
      <circle cx={x} cy={y} r={8} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1} strokeDasharray="2 2" />
      <text x={x} y={y + 3.4} textAnchor="middle" fontSize={8.5} fontWeight="700"
        fill={c.text} fontFamily="var(--font-mono, monospace)">{amount}</text>
    </g>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RouletteTable() {
  const [prefs] = useState(loadRoulettePrefs)
  const [wheel,     setWheel]     = useState(prefs.wheel)
  const [verify,    setVerify]    = useState(prefs.verify)
  const [chipValue, setChipValue] = useState(prefs.chipValue)
  const [showList,  setShowList]  = useState(false)

  const [bankroll, setBankroll] = useState(STARTING_BANKROLL)
  const [bets,     setBets]     = useState({})   // spotId -> amount
  const [order,    setOrder]    = useState([])   // placement order, for undo
  const [phase,    setPhase]    = useState('betting') // betting|spinning|verify|settled
  const [winner,   setWinner]   = useState(null)
  const [spinId,   setSpinId]   = useState(0)
  const [result,   setResult]   = useState(null)
  const [history,  setHistory]  = useState([])
  const [message,  setMessage]  = useState('Place your bets')

  const [answer,   setAnswer]   = useState('')
  const [mistakes, setMistakes] = useState([])
  const [stats, setStats] = useState({ spins: 0, wins: 0, losses: 0, checks: 0, checksRight: 0 })

  const spots   = useMemo(() => buildBetSpots(wheel), [wheel])
  const spotById = useMemo(() => Object.fromEntries(spots.map(s => [s.id, s])), [spots])

  useEffect(() => { saveRoulettePrefs({ wheel, verify, chipValue }) }, [wheel, verify, chipValue])

  const staked = useMemo(() => Object.values(bets).reduce((s, a) => s + a, 0), [bets])
  const canSpin = phase === 'betting' && staked > 0

  // ── Betting ────────────────────────────────────────────────────
  const place = useCallback((spotId) => {
    if (phase !== 'betting') return
    if (chipValue > bankroll) return
    setBets(b => ({ ...b, [spotId]: (b[spotId] ?? 0) + chipValue }))
    setOrder(o => [...o, { spotId, amount: chipValue }])
    setBankroll(b => b - chipValue)
    setMessage('Place your bets')
  }, [phase, chipValue, bankroll])

  const undo = useCallback(() => {
    if (phase !== 'betting' || order.length === 0) return
    const last = order[order.length - 1]
    setOrder(o => o.slice(0, -1))
    setBankroll(b => b + last.amount)
    setBets(b => {
      const next = { ...b }
      const left = (next[last.spotId] ?? 0) - last.amount
      if (left > 0) next[last.spotId] = left; else delete next[last.spotId]
      return next
    })
  }, [phase, order])

  const clearBets = useCallback(() => {
    if (phase !== 'betting') return
    setBankroll(b => b + staked)
    setBets({}); setOrder([])
  }, [phase, staked])

  // ── Spin ───────────────────────────────────────────────────────
  const doSpin = useCallback(() => {
    if (!canSpin) return
    const w = spin(wheel)
    setWinner(w)
    setPhase('spinning')
    setMessage('No more bets')
    setSpinId(id => id + 1)
  }, [canSpin, wheel])

  // Called by the wheel when the ball comes to rest.
  const onSettled = useCallback(() => {
    const placed = Object.entries(bets).map(([id, amount]) => {
      const s = spotById[id]
      return { id, type: s.type, label: s.label, numbers: s.numbers, payout: s.payout, amount, cx: s.cx, cy: s.cy }
    })
    const r = settleSpin(placed, winner)
    setResult(r)
    setHistory(h => [winner, ...h].slice(0, 18))
    if (verify) {
      setPhase('verify')
      setAnswer('')
      setMessage(`${winner} — what does the table pay?`)
    } else {
      payOut(r)
    }
    // payOut is stable for this round's data; re-running on identity is noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bets, spotById, winner, verify])

  const payOut = useCallback((r) => {
    setBankroll(b => b + r.returned + r.payout)
    setPhase('settled')
    setStats(s => ({
      ...s,
      spins: s.spins + 1,
      wins:   s.wins + (r.net > 0 ? 1 : 0),
      losses: s.losses + (r.net < 0 ? 1 : 0),
    }))
    setMessage(r.net > 0 ? `${r.winner} — pays ${money(r.payout)}`
      : r.net < 0 ? `${r.winner} — table takes ${money(-r.net)}`
      : `${r.winner} — push`)
  }, [])

  const submitAnswer = () => {
    const given = parseFloat(String(answer).replace(/[$,\s]/g, ''))
    if (isNaN(given)) return
    const right = Math.abs(given - result.payout) < 0.01
    setStats(s => ({ ...s, checks: s.checks + 1, checksRight: s.checksRight + (right ? 1 : 0) }))
    if (!right) {
      const winners = result.results.filter(r => r.won)
      setMistakes(m => [{
        id: Date.now() + Math.random(),
        winner: key(result.winner),
        given, correct: result.payout,
        detail: winners.length
          ? winners.map(w => `${BET_TYPE_LABELS[w.type]} ${money(w.amount)} × ${w.payout} = ${money(w.amount * w.payout)}`).join('  ·  ')
          : 'No bet covered the winning number — the table pays nothing.',
      }, ...m].slice(0, 25))
    }
    setVerdict({ right, given })
  }

  const [verdict, setVerdict] = useState(null)

  const continueAfterVerify = () => {
    setVerdict(null)
    payOut(result)
  }

  const nextRound = () => {
    setBets({}); setOrder([]); setResult(null); setVerdict(null)
    setPhase('betting')
    setMessage('Place your bets')
  }

  const changeWheel = (w) => {
    if (phase !== 'betting' && phase !== 'settled') return
    if (phase === 'settled') nextRound()
    clearBets()
    setWheel(w)
    setHistory([])
    setMessage(`${w === 'american' ? 'Double-zero' : 'Single-zero'} wheel — place your bets`)
  }

  const resetSession = () => {
    setBankroll(STARTING_BANKROLL)
    setBets({}); setOrder([]); setResult(null); setVerdict(null); setHistory([])
    setStats({ spins: 0, wins: 0, losses: 0, checks: 0, checksRight: 0 })
    setMistakes([])
    setPhase('betting'); setMessage('Session reset — place your bets')
  }

  // Keyboard: space spins / advances
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      if (k !== ' ' && k !== 'enter') return
      if (phase === 'betting' && canSpin) { e.preventDefault(); doSpin() }
      else if (phase === 'settled') { e.preventDefault(); nextRound() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, canSpin, doSpin])

  const settled = phase === 'settled' || phase === 'verify'
  const wonIds = useMemo(
    () => new Set((result?.results ?? []).filter(r => r.won).map(r => r.id)),
    [result])

  const rows = [
    [3,6,9,12,15,18,21,24,27,30,33,36],
    [2,5,8,11,14,17,20,23,26,29,32,35],
    [1,4,7,10,13,16,19,22,25,28,31,34],
  ]
  const american = wheel === 'american'
  const tally = useMemo(() => tallyHistory(history), [history])
  const panel = { background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }
  const checkPct = stats.checks > 0 ? Math.round((stats.checksRight / stats.checks) * 100) : null

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex gap-2 mb-3">
        <StatBox label="Bankroll" value={money(bankroll)} gold />
        <StatBox label="Wagered" value={money(staked)} />
        <StatBox label="Last"
          value={history.length ? key(history[0]) : '—'}
          color={history.length
            ? (colorOf(history[0]) === 'red' ? '#f87171'
              : colorOf(history[0]) === 'green' ? 'var(--color-brand-success)' : 'var(--color-brand-text)')
            : undefined} />
      </div>

      {/* ── Wheel + recent numbers ── */}
      <div className="rounded-3xl px-4 py-5 mb-3 flex flex-col sm:flex-row items-center gap-5"
        style={{ background: 'radial-gradient(ellipse 120% 90% at 50% -10%, #14724a 0%, #0b4f33 55%, #073d27 100%)',
          border: '1px solid rgba(212,168,67,0.35)',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.3)' }}>
        <div className="w-full sm:w-auto sm:flex-1 max-w-[340px]">
          <RouletteWheel wheel={wheel} winner={winner} spinId={spinId}
            onSettled={onSettled} dim={phase === 'betting' && !!result} />
        </div>

        <div className="w-full sm:flex-1 min-w-0">
          <p className="text-center sm:text-left text-sm mb-3" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {message}
          </p>
          <p className="text-[10px] font-mono uppercase mb-2"
            style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}>
            Last {history.length} spin{history.length === 1 ? '' : 's'}
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {history.length === 0 && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>No spins yet</span>
            )}
            {history.map((h, i) => (
              <span key={i} className="inline-flex items-center justify-center rounded text-[11px] font-mono font-bold"
                style={{ minWidth: 26, height: 24, padding: '0 5px',
                  background: colorOf(h) === 'red' ? '#c1272d' : colorOf(h) === 'green' ? '#12794a' : '#16181d',
                  color: '#fff',
                  border: i === 0 ? '1.5px solid var(--color-brand-gold)' : '1px solid rgba(255,255,255,0.18)' }}>
                {key(h)}
              </span>
            ))}
          </div>
          {history.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <span>Red {tally.red} · Black {tally.black} · Zero {tally.green}</span>
              <span>Odd {tally.odd} · Even {tally.even}</span>
              <span>1–18 {tally.low} · 19–36 {tally.high}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Betting layout ── */}
      <div className="rounded-2xl overflow-hidden mb-3" style={{ border: '1px solid var(--color-brand-border)' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full block"
          style={{ background: '#0b1a0b', touchAction: 'manipulation' }}>
          <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#1a4a1a" />

          {/* Zeros */}
          {american ? (
            <>
              <rect x={0} y={0} width={ZW} height={CH * 1.5} fill="#16a34a" stroke="#15803d" />
              <text x={ZW / 2} y={CH * 0.75 + 4} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#fff">00</text>
              <rect x={0} y={CH * 1.5} width={ZW} height={CH * 1.5} fill="#16a34a" stroke="#15803d" />
              <text x={ZW / 2} y={CH * 2.25 + 4} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#fff">0</text>
            </>
          ) : (
            <>
              <rect x={0} y={0} width={ZW} height={CH * 3} fill="#16a34a" stroke="#15803d" />
              <text x={ZW / 2} y={CH * 1.5 + 4} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#fff">0</text>
            </>
          )}

          {/* Numbers */}
          {rows.flat().map(n => {
            const { x, y } = cellOf(n)
            const isWin = settled && key(winner) === key(n)
            return (
              <g key={n}>
                <rect x={x} y={y} width={CW} height={CH}
                  fill={RED_NUMS.has(n) ? '#c1272d' : '#16181d'}
                  stroke={isWin ? 'var(--color-brand-gold)' : '#374151'}
                  strokeWidth={isWin ? 2.5 : 0.5} />
                <text x={x + CW / 2} y={y + CH / 2 + 5} textAnchor="middle" fontSize={11}
                  fontWeight="600" fill="#fff">{n}</text>
              </g>
            )
          })}

          {/* Columns / dozens / even money */}
          {[0, 1, 2].map(r => (
            <g key={`c${r}`}>
              <rect x={ZW + GRID_W} y={r * CH} width={38} height={CH} fill="#1e4e1e" stroke="#15803d" />
              <text x={ZW + GRID_W + 19} y={r * CH + CH / 2 + 4} textAnchor="middle" fontSize={9}
                fontWeight="bold" fill="#fff">2:1</text>
            </g>
          ))}
          {['1st 12', '2nd 12', '3rd 12'].map((l, i) => {
            const w = GRID_W / 3
            return (
              <g key={l}>
                <rect x={ZW + i * w} y={CH * 3} width={w} height={40} fill="#1e4e1e" stroke="#15803d" />
                <text x={ZW + i * w + w / 2} y={CH * 3 + 25} textAnchor="middle" fontSize={11}
                  fontWeight="600" fill="#fff">{l}</text>
              </g>
            )
          })}
          {['1-18', 'EVEN', 'RED', 'BLACK', 'ODD', '19-36'].map((l, i) => {
            const w = GRID_W / 6
            return (
              <g key={l}>
                <rect x={ZW + i * w} y={CH * 3 + 40} width={w} height={40}
                  fill={l === 'RED' ? '#991b1b' : l === 'BLACK' ? '#16181d' : '#1e4e1e'} stroke="#15803d" />
                <text x={ZW + i * w + w / 2} y={CH * 3 + 65} textAnchor="middle" fontSize={10}
                  fontWeight="600" fill="#fff">{l}</text>
              </g>
            )
          })}

          {/* Hit zones — rects first, then edge/corner hotspots on top so the
              more specific bet wins a click near a boundary, as on a real felt. */}
          {phase === 'betting' && spots.filter(s => s.hit.shape === 'rect').map(s => (
            <rect key={s.id} x={s.hit.x} y={s.hit.y} width={s.hit.w} height={s.hit.h}
              fill="transparent" style={{ cursor: 'pointer' }} onClick={() => place(s.id)}>
              <title>{s.label} — pays {s.payout}:1</title>
            </rect>
          ))}
          {phase === 'betting' && spots.filter(s => s.hit.shape === 'circle').map(s => (
            <circle key={s.id} cx={s.hit.cx} cy={s.hit.cy} r={s.hit.r}
              fill="transparent" style={{ cursor: 'pointer' }} onClick={() => place(s.id)}>
              <title>{s.label} — pays {s.payout}:1</title>
            </circle>
          ))}

          {/* Wagered chips */}
          {Object.entries(bets).map(([id, amount]) => {
            const s = spotById[id]
            if (!s) return null
            return <TableChip key={id} x={s.cx} y={s.cy} amount={amount}
              won={wonIds.has(id)} settled={settled} />
          })}

          {/* Winning zero marker */}
          {settled && (key(winner) === '0' || key(winner) === '00') && (
            <rect x={0} y={american ? (key(winner) === '00' ? 0 : CH * 1.5) : 0}
              width={ZW} height={american ? CH * 1.5 : CH * 3}
              fill="none" stroke="var(--color-brand-gold)" strokeWidth={2.5} />
          )}
        </svg>
      </div>

      {/* ── Verify prompt ── */}
      {phase === 'verify' && (
        <div className="rounded-2xl px-4 py-4 mb-3 alert-enter"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-gold-dim)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-brand-gold)' }}>
            {key(winner)} — verify the payout
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-brand-muted)' }}>
            Total winnings owed on this spread, not counting returned stakes.
          </p>
          {verdict ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                {verdict.right
                  ? <CheckCircle size={18} style={{ color: 'var(--color-brand-success)' }} />
                  : <XCircle size={18} style={{ color: 'var(--color-brand-danger)' }} />}
                <span className="text-sm font-semibold"
                  style={{ color: verdict.right ? 'var(--color-brand-success)' : '#fca5a5' }}>
                  {verdict.right ? `Correct — ${money(result.payout)}`
                    : `The table pays ${money(result.payout)}, not ${money(verdict.given)}`}
                </span>
              </div>
              {result.results.filter(r => r.won).length > 0 && (
                <div className="rounded-xl px-3 py-2.5 mb-3"
                  style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}>
                  {result.results.filter(r => r.won).map(r => (
                    <p key={r.id} className="text-xs mb-1 last:mb-0" style={{ color: 'var(--color-brand-text)' }}>
                      {r.label} — {money(r.amount)} × {r.payout} ={' '}
                      <span style={{ color: 'var(--color-brand-gold)' }}>{money(r.amount * r.payout)}</span>
                    </p>
                  ))}
                  <p className="text-xs mt-2 pt-2 font-semibold"
                    style={{ borderTop: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
                    Total {money(result.payout)} + {money(result.returned)} returned stakes
                  </p>
                </div>
              )}
              <button onClick={continueAfterVerify}
                className="w-full py-3 rounded-xl font-semibold text-sm"
                style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }}>
                Pay the table
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <input type="text" inputMode="decimal" value={answer} autoFocus
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitAnswer()}
                placeholder="$0.00"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono min-w-0"
                style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)',
                  color: 'var(--color-brand-text)' }} />
              <button onClick={submitAnswer} className="px-5 rounded-xl font-semibold text-sm shrink-0"
                style={{ background: 'var(--color-brand-gold)', color: '#1a1405' }}>Check</button>
            </div>
          )}
        </div>
      )}

      {/* ── Controls ── */}
      <div className="rounded-2xl px-4 py-4 mb-3" style={panel}>
        {phase === 'betting' && (
          <>
            <div className="flex items-center justify-center gap-2.5 mb-4 flex-wrap">
              {CHIPS.map(c => (
                <Chip key={c.value} chip={c} selected={chipValue === c.value}
                  onClick={() => setChipValue(c.value)} disabled={c.value > bankroll} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={undo} disabled={order.length === 0}
                className="px-3 py-3 rounded-xl text-sm font-semibold shrink-0 disabled:opacity-35 active:scale-[0.97]"
                style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}
                title="Undo last chip"><Undo2 size={15} /></button>
              <button onClick={clearBets} disabled={staked === 0}
                className="px-3 py-3 rounded-xl text-sm font-semibold shrink-0 disabled:opacity-35 active:scale-[0.97]"
                style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}
                title="Clear all bets"><Trash2 size={15} /></button>
              <button onClick={doSpin} disabled={!canSpin}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98]"
                style={{ background: 'var(--color-brand-gold)', color: '#1a1405' }}>
                Spin
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>Space</span>
              </button>
            </div>
            <p className="text-[11px] text-center mt-2.5" style={{ color: 'var(--color-brand-muted)' }}>
              Tap a number, an edge between numbers, or an outside box to place the{' '}
              <span style={{ color: 'var(--color-brand-gold)' }}>{money(chipValue)}</span> chip.
            </p>
          </>
        )}

        {phase === 'spinning' && (
          <p className="text-center text-sm py-2" style={{ color: 'var(--color-brand-muted)' }}>
            Ball is in play…
          </p>
        )}

        {phase === 'settled' && (
          <button onClick={nextRound}
            className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            style={{ background: 'var(--color-brand-gold)', color: '#1a1405' }}>
            Next Spin
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>Space</span>
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4"
          style={{ borderTop: '1px solid var(--color-brand-border)' }}>
          <Toggle label="Verify payout" sub="Compute before the table pays" on={verify} onChange={setVerify} />
          <Toggle label="Bet list" sub="Show every chip on the table" on={showList} onChange={setShowList} />
        </div>
      </div>

      {/* ── Bet list ── */}
      {showList && (
        <div className="rounded-2xl px-4 py-4 mb-3" style={panel}>
          <p className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-brand-gold)' }}>
            <ListOrdered size={14} /> Chips on the table
          </p>
          {Object.keys(bets).length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>No bets placed.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {Object.entries(bets).map(([id, amount]) => {
                const s = spotById[id]
                const won = settled && wonIds.has(id)
                return (
                  <div key={id} className="flex items-center justify-between gap-3 text-xs"
                    style={{ opacity: settled && !won ? 0.45 : 1 }}>
                    <span style={{ color: 'var(--color-brand-text)' }}>{s?.label}</span>
                    <span className="font-mono shrink-0"
                      style={{ color: won ? 'var(--color-brand-gold)' : 'var(--color-brand-muted)' }}>
                      {money(amount)} · {s?.payout}:1
                      {won && ` → ${money(amount * s.payout)}`}
                    </span>
                  </div>
                )
              })}
              <div className="flex items-center justify-between gap-3 text-xs font-semibold mt-1.5 pt-1.5"
                style={{ borderTop: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text)' }}>
                <span>Total wagered</span><span className="font-mono">{money(staked)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Table rules ── */}
      <div className="rounded-2xl px-4 py-4 mb-3" style={panel}>
        <p className="text-sm font-bold mb-3" style={{ color: 'var(--color-brand-gold)' }}>Table Rules</p>
        <p className="text-[10px] font-mono uppercase mb-1.5"
          style={{ color: 'var(--color-brand-muted)', letterSpacing: '0.12em' }}>Wheel</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[['american', 'American 00'], ['european', 'European 0']].map(([id, label]) => (
            <button key={id} onClick={() => changeWheel(id)}
              disabled={phase === 'spinning' || phase === 'verify'}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 active:scale-[0.96]"
              style={{ background: wheel === id ? 'var(--color-brand-gold)' : 'var(--color-brand-bg)',
                color: wheel === id ? '#1a1405' : 'var(--color-brand-muted)',
                border: `1px solid ${wheel === id ? 'var(--color-brand-gold)' : 'var(--color-brand-border)'}` }}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px]" style={{ color: 'var(--color-brand-muted)' }}>
          {american
            ? '38 pockets. House edge 5.26% — and 7.89% on the Top Line, the worst bet on the layout. This is the house game.'
            : '37 pockets, no 00 and no Top Line. House edge 2.70% on every bet.'}
        </p>
      </div>

      {/* ── Session ── */}
      <div className="rounded-2xl px-4 py-4 mb-3" style={panel}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold" style={{ color: 'var(--color-brand-gold)' }}>Session</p>
          <button onClick={resetSession} className="flex items-center gap-1.5 text-xs active:scale-[0.96]"
            style={{ color: 'var(--color-brand-muted)' }}><RotateCcw size={12} /> Reset</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Spins" value={stats.spins} />
          <StatBox label="Won" value={stats.wins} />
          <StatBox label="Lost" value={stats.losses} />
        </div>
        {stats.checks > 0 && (
          <div className="rounded-xl px-3 py-2.5 mt-3"
            style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-gold-dim)' }}>
            <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
              Payout checks:{' '}
              <span style={{ color: checkPct >= 80 ? 'var(--color-brand-success)' : 'var(--color-brand-gold)' }}>
                {stats.checksRight} / {stats.checks} ({checkPct}%)
              </span>
            </p>
          </div>
        )}
      </div>

      {/* ── Mistake log ── */}
      <div className="rounded-2xl px-4 py-4 mb-3" style={panel}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-brand-gold)' }}>
            <AlertTriangle size={14} /> Payout Misses
          </p>
          <span className="text-xs font-mono px-2 py-0.5 rounded-lg"
            style={{ background: 'var(--color-brand-bg)', color: 'var(--color-brand-muted)', border: '1px solid var(--color-brand-border)' }}>
            {mistakes.length}
          </span>
        </div>
        {mistakes.length === 0 ? (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-brand-muted)' }}>
            Turn on Verify payout and spin — any payout you get wrong lands here with the breakdown.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {mistakes.map(m => (
              <div key={m.id} className="rounded-xl px-3 py-2.5"
                style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--color-brand-text)' }}>
                  {m.winner} — said <span style={{ color: 'var(--color-brand-danger)' }}>{money(m.given)}</span>
                  {', actual '}<span style={{ color: 'var(--color-brand-success)' }}>{money(m.correct)}</span>
                </p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-brand-muted)' }}>{m.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-center leading-relaxed px-4" style={{ color: 'var(--color-brand-muted)' }}>
        Payouts are stated as winnings only — the returned stake is listed separately, matching how the
        payout drills ask for the answer. Every pocket is equally likely on every spin; the results
        board is history, not a prediction. Play money only; nothing here is recorded.
      </p>
    </div>
  )
}
