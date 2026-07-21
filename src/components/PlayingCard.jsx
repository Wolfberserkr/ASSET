// Shared playing-card renderer used by the Blackjack strategy trainer and the
// poker winner trainers. Accurate corner indices + classic center pip layouts.
import { useEffect, useRef, useState } from 'react'

// Sizes trainer cards to fill the felt: measures the felt's content width and
// scales the widest card row to fit it, clamped to [0.45, maxScale]. Cards
// grow to roughly double on desktop and shrink-to-fit on phones.
const LABEL_OVERHEAD = 160 // two w-16 label columns + row gaps

export function useFeltScale(widestRowCards, maxScale) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rowW = widestRowCards * 84 - (widestRowCards - 1) * 18 // row width at scale 1
    const compute = (w) => {
      const s = Math.max(0.45, Math.min(maxScale, (w - LABEL_OVERHEAD) / rowW))
      setScale(Math.round(s * 100) / 100)
    }
    compute(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => compute(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [widestRowCards, maxScale])

  return [ref, scale]
}

export const SUIT_META = {
  s: { sym: '♠', color: '#1c2233' },
  c: { sym: '♣', color: '#1c2233' },
  h: { sym: '♥', color: '#c62828' },
  d: { sym: '♦', color: '#c62828' },
}

// Classic pip layouts for 2–10, as [x, y] fractions of the pip area.
const PIP_LAYOUTS = {
  2:  [[.5, .12], [.5, .88]],
  3:  [[.5, .12], [.5, .5], [.5, .88]],
  4:  [[.28, .12], [.72, .12], [.28, .88], [.72, .88]],
  5:  [[.28, .12], [.72, .12], [.5, .5], [.28, .88], [.72, .88]],
  6:  [[.28, .12], [.72, .12], [.28, .5], [.72, .5], [.28, .88], [.72, .88]],
  7:  [[.28, .12], [.72, .12], [.5, .31], [.28, .5], [.72, .5], [.28, .88], [.72, .88]],
  8:  [[.28, .12], [.72, .12], [.5, .31], [.28, .5], [.72, .5], [.5, .69], [.28, .88], [.72, .88]],
  9:  [[.28, .12], [.72, .12], [.28, .37], [.72, .37], [.5, .5], [.28, .63], [.72, .63], [.28, .88], [.72, .88]],
  10: [[.28, .12], [.72, .12], [.5, .245], [.28, .37], [.72, .37], [.28, .63], [.72, .63], [.5, .755], [.28, .88], [.72, .88]],
}

const BASE_W = 84
const BASE_H = 118

export function CardBack({ rotate = 0, delay = 0, overlap = false, scale = 1 }) {
  return (
    <div
      className="card-deal"
      style={{
        width: BASE_W * scale, height: BASE_H * scale, borderRadius: 9 * scale, padding: 5 * scale,
        background: 'linear-gradient(160deg, #ffffff 0%, #f0f0e8 100%)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)',
        '--deal-rot': `${rotate}deg`,
        transform: `rotate(${rotate}deg)`,
        animationDelay: `${delay}ms`,
        marginLeft: overlap ? -18 * scale : 0,
        flexShrink: 0,
      }}
    >
      <div style={{
        width: '100%', height: '100%', borderRadius: 5 * scale,
        background: 'repeating-linear-gradient(45deg, #26418f 0 5px, #1b2f6b 5px 10px)',
        border: '1px solid #16255a',
      }} />
    </div>
  )
}

export default function PlayingCard({ card, rotate = 0, delay = 0, overlap = false, scale = 1 }) {
  const { sym, color } = SUIT_META[card.suit]
  const isFace = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K'
  const isAce  = card.rank === 'A'
  const pips   = PIP_LAYOUTS[parseInt(card.rank, 10)]

  const corner = (bottom) => (
    <div
      style={{
        position: 'absolute',
        ...(bottom
          ? { bottom: 5 * scale, right: 6 * scale, transform: 'rotate(180deg)' }
          : { top: 5 * scale, left: 6 * scale }),
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        color, lineHeight: 1,
      }}
    >
      <span style={{ fontSize: 14 * scale, fontWeight: 700, fontFamily: 'var(--font-sans)', letterSpacing: '-0.5px' }}>
        {card.rank}
      </span>
      <span style={{ fontSize: 11 * scale, marginTop: 1 }}>{sym}</span>
    </div>
  )

  return (
    <div
      className="card-deal"
      style={{
        width: BASE_W * scale, height: BASE_H * scale, borderRadius: 9 * scale, position: 'relative',
        background: 'linear-gradient(160deg, #ffffff 0%, #f4f4ec 100%)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)',
        '--deal-rot': `${rotate}deg`,
        transform: `rotate(${rotate}deg)`,
        animationDelay: `${delay}ms`,
        marginLeft: overlap ? -18 * scale : 0,
        flexShrink: 0,
      }}
    >
      {corner(false)}
      {corner(true)}

      {isAce && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, fontSize: (card.suit === 's' ? 46 : 42) * scale,
        }}>
          {sym}
        </div>
      )}

      {isFace && (
        <div style={{
          position: 'absolute', inset: '16% 24%',
          border: `1.5px solid ${color}99`, borderRadius: 6 * scale,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2 * scale, color,
        }}>
          <span style={{ fontSize: 13 * scale }}>{sym}</span>
          <span style={{ fontSize: 26 * scale, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
            {card.rank}
          </span>
          <span style={{ fontSize: 13 * scale, transform: 'rotate(180deg)' }}>{sym}</span>
        </div>
      )}

      {pips && (
        <div style={{ position: 'absolute', inset: '11% 21%' }}>
          {pips.map(([x, y], i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${x * 100}%`, top: `${y * 100}%`,
                transform: `translate(-50%, -50%)${y > 0.55 ? ' rotate(180deg)' : ''}`,
                color, fontSize: (pips.length >= 8 ? 14 : 16) * scale, lineHeight: 1,
              }}
            >
              {sym}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
