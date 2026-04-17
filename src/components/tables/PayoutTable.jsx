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
import { ZW, CW, CH, RED_NUMS } from '../../lib/rouletteScenario'

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
    <div className="flex gap-0" style={{ background: '#0b1a0b' }}>
      {/* ── SVG table ───────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
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

          {/* Winning number blue dot */}
          {(() => {
            const r = 5
            const style = { fill: '#1d4ed8', stroke: '#93c5fd', strokeWidth: 1.5 }
            if (win00) return <circle cx={ZW / 2} cy={CH * 0.75} r={r} {...style} />
            if (win0)  return <circle cx={ZW / 2} cy={CH * 2.25} r={r} {...style} />
            const wNum = Number(winStr)
            if (wNum >= 1 && wNum <= 36) {
              const c = cellOf(wNum)
              return <circle cx={c.cx} cy={c.cy} r={r} {...style} />
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

      {/* ── Bet list (right panel) ───────────────────────────── */}
      <div className="flex flex-col w-52 shrink-0" style={{ borderLeft: '1px solid #15803d' }}>
        <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #1a3a1a' }}>
          <p className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: '#86efac' }}>Bets on the Table</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
          {bets.map((bet, i) => {
            const s = CHIP_COLORS[bet.chip?.color] ?? CHIP_COLORS.Red
            return (
              <div key={i} className="flex flex-col gap-1 py-1.5"
                style={{ borderBottom: i < bets.length - 1 ? '1px solid #1a3a1a' : 'none' }}>
                <span className="text-xs font-medium leading-tight" style={{ color: '#d1fae5' }}>
                  {bet.label}
                </span>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span style={{
                      display: 'inline-block', width: 8, height: 8,
                      borderRadius: '50%', background: s.bg, border: `1.5px solid ${s.border}`,
                      boxShadow: '0 0 4px #fbbf24aa', flexShrink: 0,
                    }} />
                    <span className="text-xs" style={{ color: '#9ca3af' }}>
                      ${bet.chip?.denomination} {bet.chip?.color}
                    </span>
                  </span>
                  <span className="text-xs font-mono font-bold" style={{ color: '#fbbf24' }}>
                    ${bet.amount}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="px-3 py-2.5" style={{ borderTop: '1px solid #15803d' }}>
          <p className="text-xs font-mono" style={{ color: '#6b7280' }}>Winnings only</p>
          <p className="text-xs font-mono font-bold mt-0.5" style={{ color: '#fbbf24' }}>???</p>
        </div>
      </div>
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
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

function LIRTable({ chips }) {
  const W = 420, H = 190
  const spots = [
    { label: '①', sub: 'BET 1', cx: 105 },
    { label: '②', sub: 'BET 2', cx: 210 },
    { label: '$',  sub: 'BET $', cx: 318 },
  ]
  const perSpotChips = chips
    ? chips.map(c => ({ ...c, count: Math.max(1, Math.ceil(c.count / 3)) }))
    : []

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#1a4a1a" />
      <text x={W / 2} y={22} textAnchor="middle" fontSize={11}
        fontWeight="bold" fill="#fbbf24" fontFamily="sans-serif" letterSpacing={2}>LET IT RIDE</text>
      {spots.map(({ label, sub, cx }) => {
        const cy = 105, r = 52
        return (
          <g key={label}>
            <circle cx={cx} cy={cy} r={r + 6} fill="#fbbf24" opacity={0.15} />
            <circle cx={cx} cy={cy} r={r} fill="#2d5a2d" stroke="#fbbf24" strokeWidth={2.5} />
            <text x={cx} y={cy - 8} textAnchor="middle"
              fontSize={22} fontWeight="bold" fill="#fbbf24" fontFamily="sans-serif">{label}</text>
            <text x={cx} y={cy + 14} textAnchor="middle"
              fontSize={8} fill="#d1fae5" fontFamily="sans-serif" letterSpacing={1}>{sub}</text>
            <ChipsOnTable chips={perSpotChips} cx={cx} cy={cy - 28} />
          </g>
        )
      })}
      <text x={W / 2} y={H - 10} textAnchor="middle"
        fontSize={8} fill="#86efac" fontFamily="sans-serif">
        All active bets highlighted — total wager shown below
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 210 }}>
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
// DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Props for Roulette:   gameName + scenario
 * Props for other games: gameName + chips + totalBet
 */
export default function PayoutTable({ gameName, scenario, chips, totalBet, activeBet }) {
  const name = (gameName ?? '').toLowerCase()

  if (name.includes('roulette') && scenario) {
    return (
      <div className="w-full rounded-2xl overflow-hidden"
        style={{ border: '1px solid #15803d' }}>
        <RouletteTable scenario={scenario} />
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--color-brand-success)' }}>
      {name.includes('three card') && <TCPTable chips={chips} activeBet={activeBet ?? 'pair_plus'} />}
      {name.includes('let it ride') && <LIRTable chips={chips} />}
      {name.includes('ultimate texas') && <UTHTable chips={chips} />}
      <div className="flex items-center justify-center gap-2 py-2"
        style={{ background: '#081508', borderTop: '1px solid var(--color-brand-success)' }}>
        <span className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>
          Total bet on table:
        </span>
        <span className="text-sm font-bold font-mono" style={{ color: 'var(--color-brand-success)' }}>
          ${totalBet?.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
