/**
 * PayoutTable.jsx — Phase 3 SVG table layouts for payout drills
 *
 * Roulette: accepts a `scenario` prop (from generateRouletteScenario()).
 *   Renders a full American layout (0 + 00) with all placed bets and the
 *   winning number highlighted. Agents must calculate total payout.
 *
 * TCP / LIR / UTH: unchanged — still use chips + totalBet props.
 *
 * Usage:
 *   <PayoutTable gameName="Roulette"          scenario={rouletteScenario} />
 *   <PayoutTable gameName="Three Card Poker"  chips={[...]} totalBet={100} />
 */
import { lazy, Suspense, useState } from 'react'
import { ZW, CW, CH, RED_NUMS } from '../../lib/rouletteScenario'

const RouletteTable3D = lazy(() => import('./RouletteTable3D'))
const CrapsTable3D    = lazy(() => import('./CrapsTable3D'))

// Shared 2D/3D view toggle used by the Roulette and Craps renderers.
function ViewToggle({ mode, setMode }) {
  return (
    <div className="flex items-center justify-end gap-2 px-3 py-2"
      style={{ background: '#0a1f0a', borderBottom: '1px solid #15803d' }}>
      <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#86efac' }}>View:</span>
      <div className="flex rounded-md overflow-hidden text-xs font-semibold">
        {['2d', '3d'].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="px-3 py-1 transition-colors"
            style={{
              background: mode === m ? '#fbbf24' : '#1a3a1a',
              color:      mode === m ? '#000'    : '#86efac',
            }}
          >{m.toUpperCase()}</button>
        ))}
      </div>
    </div>
  )
}

function TableLoading() {
  return (
    <div className="flex items-center justify-center text-xs font-mono"
      style={{ height: 340, color: '#86efac', background: '#06120a' }}>
      Loading 3D table…
    </div>
  )
}

// ─── Shared chip color map ────────────────────────────────────────────────────

const CHIP_COLORS = {
  White:  { bg: '#e5e7eb', text: '#111827', border: '#9ca3af' },
  Red:    { bg: '#991b1b', text: '#ffffff', border: '#7f1d1d' },
  Green:  { bg: '#14532d', text: '#ffffff', border: '#052e16' },
  Black:  { bg: '#1c1917', text: '#ffffff', border: '#78716c' },
  Purple: { bg: '#7c3aed', text: '#ffffff', border: '#5b21b6' },
  Pink:   { bg: '#db2777', text: '#ffffff', border: '#be185d' },
}

// ─── Chip stack (used by non-Roulette tables) ─────────────────────────────────

function ChipsOnTable({ chips, cx, cy }) {
  if (!chips || chips.length === 0) return null

  const discs = []
  for (const chip of [...chips].reverse()) {
    for (let i = 0; i < Math.min(chip.count, 4); i++) {
      discs.push({ color: chip.color, denomination: chip.denomination })
    }
  }
  const visible = discs.slice(0, 8)

  return (
    <g>
      {visible.map((disc, i) => {
        const s      = CHIP_COLORS[disc.color] ?? CHIP_COLORS.Red
        const stackY = cy - i * 5
        return (
          <ellipse key={i} cx={cx} cy={stackY} rx={15} ry={5.5}
            fill={s.bg} stroke={s.border} strokeWidth={1.5} />
        )
      })}
      {(() => {
        const top   = visible[visible.length - 1]
        const s     = CHIP_COLORS[top.color] ?? CHIP_COLORS.Red
        const topY  = cy - (visible.length - 1) * 5
        const label = top.denomination >= 1000
          ? `${top.denomination / 1000}K`
          : `$${top.denomination}`
        return (
          <>
            <ellipse cx={cx} cy={topY} rx={15} ry={5.5}
              fill={s.bg} stroke={s.border} strokeWidth={2} />
            <text x={cx} y={topY + 3.5} textAnchor="middle"
              fontSize={7} fontWeight="bold" fontFamily="monospace" fill={s.text}>
              {label}
            </text>
          </>
        )
      })()}
    </g>
  )
}

// ─── Single-bet chip (flat top-view circle) for Roulette scenario ────────────

function BetChip({ bet }) {
  if (!bet.chip) return null
  const { color, denomination } = bet.chip
  const s     = CHIP_COLORS[color] ?? CHIP_COLORS.Red
  const label = denomination >= 1000 ? `${denomination / 1000}K` : `$${denomination}`
  return (
    <g filter="url(#chipGlow)">
      {/* Outer chip disc */}
      <circle cx={bet.cx} cy={bet.cy} r={9} fill={s.bg} stroke={s.border} strokeWidth={1.5} />
      {/* Inner decorative ring */}
      <circle cx={bet.cx} cy={bet.cy} r={6} fill="none" stroke={s.border} strokeWidth={0.7} opacity={0.5} />
      {/* Denomination label */}
      <text x={bet.cx} y={bet.cy + 2.5} textAnchor="middle"
        fontSize={5} fontWeight="bold" fontFamily="monospace" fill={s.text}>
        {label}
      </text>
    </g>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROULETTE — multi-bet scenario
// ═══════════════════════════════════════════════════════════════════════════════

const GRID_W = CW * 12
const SVG_W  = ZW + GRID_W + 40
const SVG_H  = CH * 3 + 40 + 40 + 20

function cellOf(n) {
  const col = Math.floor((n - 1) / 3)
  const row = 2 - ((n - 1) % 3)
  return {
    x:  ZW + col * CW,
    y:  row * CH,
    cx: ZW + col * CW + CW / 2,
    cy: row * CH + CH / 2,
  }
}

function RouletteTable({ scenario }) {
  const { winningNumber, bets } = scenario
  const winStr = String(winningNumber)
  const win0   = winStr === '0'
  const win00  = winStr === '00'

  const rows = [
    [3,6,9,12,15,18,21,24,27,30,33,36],
    [2,5,8,11,14,17,20,23,26,29,32,35],
    [1,4,7,10,13,16,19,22,25,28,31,34],
  ]

  return (
    <div className="w-full" style={{ background: '#0b1a0b' }}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">

          {/* Filters */}
          <defs>
            <filter id="chipGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feFlood floodColor="#fbbf24" floodOpacity="0.75" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Felt */}
          <rect x={0} y={0} width={SVG_W} height={SVG_H} rx={8} fill="#1a4a1a" />

          {/* 00 cell */}
          <rect x={0} y={0} width={ZW} height={CH * 1.5}
            fill="#16a34a" stroke="#15803d" strokeWidth={1} />
          <text x={ZW / 2} y={CH * 0.75 + 4} textAnchor="middle"
            fontSize={11} fontWeight="bold" fill="white" fontFamily="sans-serif">00</text>

          {/* Divider */}
          <line x1={0} y1={CH * 1.5} x2={ZW} y2={CH * 1.5} stroke="#15803d" strokeWidth={1} />

          {/* 0 cell */}
          <rect x={0} y={CH * 1.5} width={ZW} height={CH * 1.5}
            fill="#16a34a" stroke="#15803d" strokeWidth={1} />
          <text x={ZW / 2} y={CH * 2.25 + 4} textAnchor="middle"
            fontSize={11} fontWeight="bold" fill="white" fontFamily="sans-serif">0</text>

          {/* Number cells */}
          {rows.map(row =>
            row.map(n => {
              const { x, y } = cellOf(n)
              const fill = RED_NUMS.has(n) ? '#dc2626' : '#1c1917'
              return (
                <g key={n}>
                  <rect x={x} y={y} width={CW} height={CH}
                    fill={fill} stroke="#374151" strokeWidth={0.5} />
                  <text x={x + CW / 2} y={y + CH / 2 + 5}
                    textAnchor="middle" fontSize={10}
                    fontWeight="600" fill="white" fontFamily="sans-serif">{n}</text>
                </g>
              )
            })
          )}

          {/* 2:1 column labels */}
          {[0, 1, 2].map(r => (
            <g key={r}>
              <rect x={ZW + GRID_W} y={r * CH} width={38} height={CH}
                fill="#16a34a" stroke="#15803d" strokeWidth={1} />
              <text x={ZW + GRID_W + 19} y={r * CH + CH / 2 + 5}
                textAnchor="middle" fontSize={8} fontWeight="bold"
                fill="white" fontFamily="sans-serif">2:1</text>
            </g>
          ))}

          {/* Dozen bets */}
          {['1st 12', '2nd 12', '3rd 12'].map((label, i) => {
            const w = GRID_W / 3
            const x = ZW + i * w
            return (
              <g key={label}>
                <rect x={x} y={CH * 3} width={w} height={40}
                  fill="#1e4e1e" stroke="#15803d" strokeWidth={1} />
                <text x={x + w / 2} y={CH * 3 + 24} textAnchor="middle"
                  fontSize={10} fontWeight="600" fill="white" fontFamily="sans-serif">{label}</text>
              </g>
            )
          })}

          {/* Even-money bets */}
          {['1-18', 'EVEN', 'RED', 'BLACK', 'ODD', '19-36'].map((label, i) => {
            const w    = GRID_W / 6
            const x    = ZW + i * w
            const y    = CH * 3 + 40
            const fill = label === 'RED' ? '#991b1b' : label === 'BLACK' ? '#1c1917' : '#1e4e1e'
            return (
              <g key={label}>
                <rect x={x} y={y} width={w} height={40}
                  fill={fill} stroke="#15803d" strokeWidth={1} />
                <text x={x + w / 2} y={y + 24} textAnchor="middle"
                  fontSize={9} fontWeight="600" fill="white" fontFamily="sans-serif">{label}</text>
              </g>
            )
          })}

          {/* Bet chips */}
          {bets.map((bet, i) => <BetChip key={i} bet={bet} />)}

          {/* Winning number blue dot — placed in the cell's top-left corner so
              it never covers a straight-up chip sitting on the winning number
              (a centered marker hides that chip's denomination, making an easy
              bet to miss when summing the payout). */}
          {(() => {
            const r = 4.5
            const off = 8
            const style = { fill: '#1d4ed8', stroke: '#93c5fd', strokeWidth: 1.5 }
            if (win00) return <circle cx={off} cy={off} r={r} {...style} />
            if (win0)  return <circle cx={off} cy={CH * 1.5 + off} r={r} {...style} />
            const wNum = Number(winStr)
            if (wNum >= 1 && wNum <= 36) {
              const c = cellOf(wNum)
              return <circle cx={c.x + off} cy={c.y + off} r={r} {...style} />
            }
            return null
          })()}

          {/* Legend */}
          <rect x={ZW + 4} y={SVG_H - 14} width={120} height={12} rx={3} fill="#0b0f1a" opacity={0.75} />
          <circle cx={ZW + 12} cy={SVG_H - 8} r={4} fill="#1d4ed8" stroke="#93c5fd" strokeWidth={1} />
          <text x={ZW + 19} y={SVG_H - 4} fontSize={7.5} fill="#93c5fd" fontFamily="sans-serif">
            = Winning Number
          </text>
      </svg>
    </div>
  )
}

// Bet list shown below the Roulette table (2D or 3D).
function BetListPanel({ bets }) {
  return (
    <div style={{ borderTop: '1px solid #15803d', background: '#0b1a0b' }}>
      <div className="px-3 py-2" style={{ borderBottom: '1px solid #1a3a1a' }}>
        <p className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: '#86efac' }}>Bets on the Table</p>
      </div>
      <div className="grid gap-2 p-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {bets.map((bet, i) => {
          const s = CHIP_COLORS[bet.chip?.color] ?? CHIP_COLORS.Red
          return (
            <div key={i} className="flex items-center justify-between px-2.5 py-2 rounded-lg"
              style={{ background: '#0f2a0f', border: '1px solid #1a3a1a' }}>
              <span className="text-xs font-medium leading-tight mr-2" style={{ color: '#d1fae5' }}>
                {bet.label}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span style={{
                  display: 'inline-block', width: 8, height: 8,
                  borderRadius: '50%', background: s.bg, border: `1.5px solid ${s.border}`,
                  flexShrink: 0,
                }} />
                <span className="text-xs font-mono font-bold" style={{ color: '#fbbf24' }}>
                  ${bet.amount}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-3 pb-2.5 flex items-center justify-between">
        <p className="text-xs font-mono" style={{ color: '#6b7280' }}>Winnings only — enter total below</p>
        <p className="text-xs font-mono font-bold" style={{ color: '#fbbf24' }}>???</p>
      </div>
    </div>
  )
}

// Roulette wrapper with a 2D / 3D view toggle.
function RouletteRenderer({ scenario }) {
  const [mode, setMode] = useState('2d')
  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ border: '1px solid #15803d' }}>
      <ViewToggle mode={mode} setMode={setMode} />
      {mode === '2d' ? (
        <RouletteTable scenario={scenario} />
      ) : (
        <Suspense fallback={<TableLoading />}>
          <RouletteTable3D scenario={scenario} />
        </Suspense>
      )}
      <BetListPanel bets={scenario.bets} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// THREE CARD POKER
// ═══════════════════════════════════════════════════════════════════════════════

function TCPTable({ chips, activeBet = 'pair_plus' }) {
  const W = 420, H = 190
  const spots = [
    { label: 'PLAY',      cx: 105, key: 'play'       },
    { label: 'ANTE',      cx: 210, key: 'ante'       },
    { label: 'PAIR PLUS', cx: 318, key: 'pair_plus'  },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 400 }}>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#1a4a1a" />
      <text x={W / 2} y={22} textAnchor="middle" fontSize={11}
        fontWeight="bold" fill="#fbbf24" fontFamily="sans-serif" letterSpacing={2}>
        THREE CARD POKER
      </text>
      {spots.map(({ label, cx, key }) => {
        const cy = 105, r = 52
        const highlight = key === activeBet
        return (
          <g key={label}>
            {highlight && <circle cx={cx} cy={cy} r={r + 6} fill="#fbbf24" opacity={0.2} />}
            <circle cx={cx} cy={cy} r={r}
              fill={highlight ? '#2d5a2d' : '#1e3e1e'}
              stroke={highlight ? '#fbbf24' : '#15803d'}
              strokeWidth={highlight ? 2.5 : 1.5} />
            <text x={cx} y={highlight ? cy - 6 : cy + 5} textAnchor="middle"
              fontSize={9} fontWeight="bold"
              fill={highlight ? '#fbbf24' : '#86efac'}
              fontFamily="sans-serif" letterSpacing={1}>{label}</text>
            {highlight && <text x={cx} y={cy + 10} textAnchor="middle"
              fontSize={8} fill="#d1fae5" fontFamily="sans-serif">active bet</text>}
            {highlight && <ChipsOnTable chips={chips} cx={cx} cy={cy - 24} />}
          </g>
        )
      })}
      {['♠', '♥', '♣', '♦'].map((suit, i) => (
        <text key={i} x={24 + i * 18} y={H - 10} textAnchor="middle"
          fontSize={11} fill={i % 2 === 0 ? '#6b7280' : '#7f1d1d'}
          fontFamily="sans-serif" opacity={0.5}>{suit}</text>
      ))}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LET IT RIDE
// ═══════════════════════════════════════════════════════════════════════════════

function LIRTable({ chips, perSpotBet }) {
  const W = 420, H = 190
  const spots = [
    { label: '①', sub: 'BET 1', cx: 105 },
    { label: '②', sub: 'BET 2', cx: 210 },
    { label: '$',  sub: 'BET $', cx: 318 },
  ]
  const spotChips = chips ?? []
  const perSpotLabel = perSpotBet != null ? `$${perSpotBet.toLocaleString()}` : ''

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 400 }}>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#1a4a1a" />
      <text x={W / 2} y={22} textAnchor="middle" fontSize={11}
        fontWeight="bold" fill="#fbbf24" fontFamily="sans-serif" letterSpacing={2}>LET IT RIDE</text>
      {spots.map(({ label, sub, cx }) => {
        const cy = 105, r = 52
        return (
          <g key={label}>
            <circle cx={cx} cy={cy} r={r + 6} fill="#fbbf24" opacity={0.15} />
            <circle cx={cx} cy={cy} r={r} fill="#2d5a2d" stroke="#fbbf24" strokeWidth={2.5} />
            <text x={cx} y={cy - 14} textAnchor="middle"
              fontSize={20} fontWeight="bold" fill="#fbbf24" fontFamily="sans-serif">{label}</text>
            <text x={cx} y={cy + 4} textAnchor="middle"
              fontSize={8} fill="#d1fae5" fontFamily="sans-serif" letterSpacing={1}>{sub}</text>
            {perSpotLabel && (
              <text x={cx} y={cy + 18} textAnchor="middle"
                fontSize={11} fontWeight="bold" fill="#86efac" fontFamily="monospace">
                {perSpotLabel}
              </text>
            )}
            <ChipsOnTable chips={spotChips} cx={cx} cy={cy - 32} />
          </g>
        )
      })}
      <text x={W / 2} y={H - 10} textAnchor="middle"
        fontSize={8} fill="#86efac" fontFamily="sans-serif">
        Three equal active bets — total wager shown below
      </text>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ULTIMATE TEXAS HOLD'EM
// ═══════════════════════════════════════════════════════════════════════════════

function UTHTable({ chips }) {
  const W = 500, H = 200
  const mainSpots = [
    { label: 'ANTE',  cx: 95  },
    { label: 'BLIND', cx: 195 },
    { label: 'PLAY',  cx: 295 },
  ]
  const tripsX = 415, tripsY = 100

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 420 }}>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#1a4a1a" />
      <text x={220} y={22} textAnchor="middle" fontSize={11}
        fontWeight="bold" fill="#fbbf24" fontFamily="sans-serif" letterSpacing={2}>
        ULTIMATE TEXAS HOLD'EM
      </text>
      {mainSpots.map(({ label, cx }) => (
        <g key={label}>
          <circle cx={cx} cy={110} r={50} fill="#1e3e1e" stroke="#15803d" strokeWidth={1.5} />
          <text x={cx} y={115} textAnchor="middle"
            fontSize={9} fontWeight="bold" fill="#86efac"
            fontFamily="sans-serif" letterSpacing={1}>{label}</text>
        </g>
      ))}
      <g>
        <circle cx={tripsX} cy={tripsY} r={40} fill="#fbbf24" opacity={0.2} />
        <circle cx={tripsX} cy={tripsY} r={34} fill="#2d5a2d" stroke="#fbbf24" strokeWidth={2.5} />
        <text x={tripsX} y={tripsY - 4} textAnchor="middle"
          fontSize={9} fontWeight="bold" fill="#fbbf24" fontFamily="sans-serif">TRIPS</text>
        <text x={tripsX} y={tripsY + 10} textAnchor="middle"
          fontSize={7} fill="#d1fae5" fontFamily="sans-serif">active bet</text>
        <ChipsOnTable chips={chips} cx={tripsX} cy={tripsY - 20} />
      </g>
      <line x1={370} y1={40} x2={370} y2={H - 20} stroke="#15803d" strokeWidth={1} strokeDasharray="4 3" />
      <text x={W - 4} y={H - 8} textAnchor="end" fontSize={8} fill="#6b7280" fontFamily="sans-serif">
        SIDE BET →
      </text>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARIBBEAN STUD POKER
// ═══════════════════════════════════════════════════════════════════════════════

function CSPTable({ chips, activeBet = 'bet' }) {
  const W = 440, H = 200
  const spots = [
    { label: 'PROG',  sub: '$1', cx: 92,  key: 'progressive', small: true },
    { label: 'ANTE',  cx: 210, key: 'ante' },
    { label: 'BET',   cx: 340, key: 'bet'  },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 420 }}>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#1a4a1a" />
      <text x={W / 2} y={22} textAnchor="middle" fontSize={11}
        fontWeight="bold" fill="#fbbf24" fontFamily="sans-serif" letterSpacing={2}>
        CARIBBEAN STUD POKER
      </text>
      {spots.map(({ label, sub, cx, key, small }) => {
        const cy = 108
        const r  = small ? 26 : 52
        const highlight = key === activeBet
        return (
          <g key={label}>
            {highlight && <circle cx={cx} cy={cy} r={r + 6} fill="#fbbf24" opacity={0.2} />}
            {small ? (
              <circle cx={cx} cy={cy} r={r}
                fill="#3a1e1e" stroke="#b91c1c" strokeWidth={2} />
            ) : (
              <circle cx={cx} cy={cy} r={r}
                fill={highlight ? '#2d5a2d' : '#1e3e1e'}
                stroke={highlight ? '#fbbf24' : '#15803d'}
                strokeWidth={highlight ? 2.5 : 1.5} />
            )}
            <text x={cx} y={highlight ? cy - 6 : cy + (small ? -1 : 5)} textAnchor="middle"
              fontSize={small ? 8 : 9} fontWeight="bold"
              fill={key === 'progressive' ? '#fca5a5' : highlight ? '#fbbf24' : '#86efac'}
              fontFamily="sans-serif" letterSpacing={1}>{label}</text>
            {sub && <text x={cx} y={cy + 9} textAnchor="middle"
              fontSize={7} fill="#d1fae5" fontFamily="sans-serif">{sub}</text>}
            {highlight && !small && <text x={cx} y={cy + 10} textAnchor="middle"
              fontSize={8} fill="#d1fae5" fontFamily="sans-serif">active bet</text>}
            {highlight && <ChipsOnTable chips={chips} cx={cx} cy={cy - 24} />}
          </g>
        )
      })}
      {['♠', '♥', '♣', '♦'].map((suit, i) => (
        <text key={i} x={24 + i * 18} y={H - 10} textAnchor="middle"
          fontSize={11} fill={i % 2 === 0 ? '#6b7280' : '#7f1d1d'}
          fontFamily="sans-serif" opacity={0.5}>{suit}</text>
      ))}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRAPS  — half layout (dealer's end of a real craps table)
// ═══════════════════════════════════════════════════════════════════════════════
//
// `activeBet` picks which area the wagered chip stack sits on and highlights
// it in gold:
//   'line'   → point boxes / Come / Don't / Pass Line  (pass/come/don't/odds/buy)
//   'field'  → the Field
//   'center' → the Propositions / Hardways block

// Felt colors — cream outlines over dark green mimic a real layout.
const C_FELT   = '#123212'
const C_LINE   = '#e8e2cf'   // cream outline
const C_TEXT   = '#eaf3ea'
const C_ON_FILL = '#2d5a2d'
const C_ON_LINE = '#fbbf24'
const C_ON_TEXT = '#fbbf24'

function CrapsRegion({ x, y, w, h, rx = 3, active, fill = C_FELT, label, fontSize = 12, letter = 1, labelDy = 0 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx}
        fill={active ? C_ON_FILL : fill}
        stroke={active ? C_ON_LINE : C_LINE} strokeWidth={active ? 2.5 : 1.2} />
      {label != null && (
        <text x={x + w / 2} y={y + h / 2 + 4 + labelDy} textAnchor="middle"
          fontSize={fontSize} fontWeight="bold" letterSpacing={letter}
          fill={active ? C_ON_TEXT : C_TEXT} fontFamily="sans-serif">{label}</text>
      )}
    </g>
  )
}

function CrapsTable({ chips, activeBet = 'line' }) {
  const W = 520, H = 300
  const lineOn   = activeBet === 'line'
  const fieldOn  = activeBet === 'field'
  const centerOn = activeBet === 'center'

  // Main betting area sits between the left (center/DC) column and the right rail.
  const mainX = 116, mainR = 484, mainW = mainR - mainX
  const boxNums = [4, 5, 'SIX', 8, 'NINE', 10]
  const boxW = mainW / 6, boxY = 30, boxH = 48

  const fieldNums = [
    { n: '2', dbl: true }, { n: '3' }, { n: '4' }, { n: '9' },
    { n: '10' }, { n: '11' }, { n: '12', dbl: true },
  ]

  const stack = lineOn
    ? { cx: 250, cy: 262 }
    : fieldOn
      ? { cx: 300, cy: 176 }
      : { cx: 60, cy: 168 }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 640 }}>
      {/* Felt */}
      <rect x={0} y={0} width={W} height={H} rx={12} fill="#0f2c12" />
      <rect x={4} y={4} width={W - 8} height={H - 8} rx={10} fill="#15441a"
        stroke="#0b230d" strokeWidth={1} />

      {/* Right-side Pass Line rail (the sweep up the side) */}
      <CrapsRegion x={mainR + 2} y={boxY} w={26} h={200 - boxY + 30} active={lineOn} fill="#1a3f1a" />

      {/* Point / box numbers — Place, Buy, Odds & the point marker live here */}
      {boxNums.map((n, i) => (
        <g key={i}>
          <CrapsRegion x={mainX + i * boxW + 1.5} y={boxY} w={boxW - 3} h={boxH}
            active={lineOn} fill="#123c12" label={String(n)} fontSize={17} />
        </g>
      ))}

      {/* Don't Come (top-left) */}
      <CrapsRegion x={8} y={boxY} w={104} h={72} active={lineOn} fill="#173417" />
      <text x={60} y={boxY + 30} textAnchor="middle" fontSize={11} fontWeight="bold"
        fill={lineOn ? C_ON_TEXT : C_TEXT} fontFamily="sans-serif">DON'T</text>
      <text x={60} y={boxY + 46} textAnchor="middle" fontSize={11} fontWeight="bold"
        fill={lineOn ? C_ON_TEXT : C_TEXT} fontFamily="sans-serif">COME</text>

      {/* Come */}
      <CrapsRegion x={mainX} y={82} w={mainW} h={64} active={lineOn} fill="#163216"
        label="COME" fontSize={18} letter={4} />

      {/* Center — Propositions & Hardways */}
      <CrapsRegion x={8} y={106} w={104} h={118} active={centerOn} fill="#112a11" />
      {[['HARD 4', '7:1'], ['HARD 10', '7:1'], ['HARD 6', '9:1'], ['HARD 8', '9:1']].map(([lbl, odd], i) => {
        const col = i % 2, row = Math.floor(i / 2)
        const hx = 14 + col * 47, hy = 112 + row * 34
        return (
          <g key={lbl}>
            <rect x={hx} y={hy} width={44} height={30} rx={2}
              fill={centerOn ? '#3a5f2f' : '#0f240f'}
              stroke={centerOn ? C_ON_LINE : '#5b7a4a'} strokeWidth={1} />
            <text x={hx + 22} y={hy + 13} textAnchor="middle" fontSize={7.5} fontWeight="bold"
              fill={centerOn ? C_ON_TEXT : '#cfe8c0'} fontFamily="sans-serif">{lbl}</text>
            <text x={hx + 22} y={hy + 24} textAnchor="middle" fontSize={7} fontFamily="monospace"
              fill={centerOn ? '#fde68a' : '#9db98c'}>{odd}</text>
          </g>
        )
      })}
      <text x={60} y={196} textAnchor="middle" fontSize={8} fontWeight="bold"
        fill={centerOn ? C_ON_TEXT : '#cfe8c0'} fontFamily="sans-serif">ANY 7 · YO · C&amp;E</text>
      <text x={60} y={210} textAnchor="middle" fontSize={8} fontWeight="bold"
        fill={centerOn ? C_ON_TEXT : '#cfe8c0'} fontFamily="sans-serif">2 · 3 · 11 · 12</text>
      <text x={60} y={100} textAnchor="middle" fontSize={7.5} letterSpacing={1}
        fill="#7f9c6f" fontFamily="sans-serif">PROPOSITIONS</text>

      {/* Field — individual numbers, 2 & 12 pay double */}
      <CrapsRegion x={mainX} y={150} w={mainW} h={50} active={fieldOn} fill="#163216" />
      <text x={mainX + 6} y={162} fontSize={8} letterSpacing={1}
        fill={fieldOn ? C_ON_TEXT : '#9db98c'} fontFamily="sans-serif">FIELD</text>
      {fieldNums.map((f, i) => {
        const fw = mainW / fieldNums.length
        const cx = mainX + i * fw + fw / 2
        return (
          <g key={f.n}>
            {f.dbl && <circle cx={cx} cy={180} r={13}
              fill="none" stroke={fieldOn ? C_ON_LINE : '#e8e2cf'} strokeWidth={1.2} />}
            <text x={cx} y={184} textAnchor="middle" fontSize={14} fontWeight="bold"
              fill={fieldOn ? C_ON_TEXT : C_TEXT} fontFamily="sans-serif">{f.n}</text>
          </g>
        )
      })}

      {/* Don't Pass Bar */}
      <CrapsRegion x={mainX} y={204} w={mainW} h={24} active={lineOn} fill="#142c14"
        label="DON'T PASS BAR" fontSize={11} letter={1} />

      {/* Pass Line (outer sweep along the bottom) */}
      <CrapsRegion x={8} y={232} w={W - 16} h={58} active={lineOn} fill="#1a3f1a"
        label="PASS LINE" fontSize={20} letter={5} />

      {/* Title */}
      <text x={W - 14} y={22} textAnchor="end" fontSize={10} fontWeight="bold"
        fill="#fbbf24" fontFamily="sans-serif" letterSpacing={3} opacity={0.85}>CRAPS</text>

      {/* Wagered chip stack on the active area */}
      <ChipsOnTable chips={chips} cx={stack.cx} cy={stack.cy} />
    </svg>
  )
}

// Craps wrapper with a 2D / 3D view toggle + total-bet footer.
function CrapsRenderer({ chips, totalBet, activeBet }) {
  const [mode, setMode] = useState('2d')
  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-brand-success)' }}>
      <ViewToggle mode={mode} setMode={setMode} />
      {mode === '2d' ? (
        <CrapsTable chips={chips} activeBet={activeBet ?? 'line'} />
      ) : (
        <Suspense fallback={<TableLoading />}>
          <CrapsTable3D chips={chips} activeBet={activeBet ?? 'line'} />
        </Suspense>
      )}
      <div className="flex flex-col items-center justify-center gap-1 py-3 px-3"
        style={{ background: '#081508', borderTop: '1px solid var(--color-brand-success)' }}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--color-brand-muted)' }}>
            Total Bet
          </span>
          <span className="text-2xl font-bold font-mono" style={{ color: 'var(--color-brand-success)' }}>
            ${totalBet?.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Props for Roulette:   gameName + scenario
 * Props for other games: gameName + chips + totalBet
 */
export default function PayoutTable({ gameName, scenario, chips, totalBet, perSpotBet, activeBet }) {
  const name  = (gameName ?? '').toLowerCase()
  const isLIR = name.includes('let it ride')

  if (name.includes('roulette') && scenario) {
    return <RouletteRenderer scenario={scenario} />
  }

  if (name.includes('craps')) {
    return <CrapsRenderer chips={chips} totalBet={totalBet} activeBet={activeBet ?? 'line'} />
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--color-brand-success)' }}>
      {name.includes('three card')    && <TCPTable chips={chips} activeBet={activeBet ?? 'pair_plus'} />}
      {isLIR                          && <LIRTable chips={chips} perSpotBet={perSpotBet} />}
      {name.includes('ultimate texas') && <UTHTable chips={chips} />}
      {name.includes('caribbean')      && <CSPTable chips={chips} activeBet={activeBet ?? 'bet'} />}
      <div className="flex flex-col items-center justify-center gap-1 py-3 px-3"
        style={{ background: '#081508', borderTop: '1px solid var(--color-brand-success)' }}>
        {isLIR && perSpotBet != null && (
          <span className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
            3 active bets × <span className="font-bold" style={{ color: '#fbbf24' }}>${perSpotBet.toLocaleString()}</span>
          </span>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--color-brand-muted)' }}>
            {isLIR ? 'Total Active Wager' : 'Total Bet'}
          </span>
          <span className="text-2xl font-bold font-mono" style={{ color: 'var(--color-brand-success)' }}>
            ${totalBet?.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
