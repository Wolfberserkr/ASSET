import { useId } from 'react'

/**
 * Donut gauge with a gradient arc and glow, centered text.
 * pct: 0–1 · colorA/colorB: gradient stops · subText: optional line under the value
 */
export default function RingGauge({ pct, size = 96, colorA, colorB, centerText, subText }) {
  const gradId = useId()
  const stroke = 7
  const r = (size - stroke - 5) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, pct))

  return (
    <svg width={size} height={size} role="img" aria-label={`${centerText}${subText ? ` — ${subText}` : ''}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colorA} />
          <stop offset="1" stopColor={colorB} />
        </linearGradient>
      </defs>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#222c50" strokeWidth={stroke} />
      <circle
        cx={c} cy={c} r={r} fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circ * clamped} ${circ}`}
        transform={`rotate(-90 ${c} ${c})`}
        style={{ filter: `drop-shadow(0 0 6px ${colorA}66)`, transition: 'stroke-dasharray 600ms ease-out' }}
      />
      <text
        x={c} y={c - (subText ? 3 : -5)}
        textAnchor="middle"
        fill="var(--color-brand-text)"
        fontSize={size / 5.4}
        fontWeight="700"
        fontFamily="var(--font-mono)"
      >
        {centerText}
      </text>
      {subText && (
        <text x={c} y={c + 15} textAnchor="middle" fill="var(--color-brand-muted)" fontSize="9">
          {subText}
        </text>
      )}
    </svg>
  )
}
