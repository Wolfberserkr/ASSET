import { useMemo } from 'react'

const W = 720
const H = 190
const PAD = 14

// Catmull-Rom → cubic bezier so the line curves smoothly through every point
function smoothPath(pts) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`
  }
  return d
}

/**
 * Glowing area chart of completed-session scores.
 * sessions: [{ score, completed_at }] in any order; rendered oldest → newest.
 * The best session gets a marker with a floating score/date chip.
 */
export default function ScoreChart({ sessions }) {
  const chart = useMemo(() => {
    const ordered = (sessions ?? [])
      .slice()
      .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
    if (ordered.length < 2) return null

    const scores = ordered.map(s => Number(s.score))
    const lo = Math.min(...scores)
    const hi = Math.max(...scores)
    const min = Math.max(0, lo - 10)
    const max = Math.min(160, hi + 10)
    const range = max - min || 1

    const pts = scores.map((s, i) => [
      PAD + (i / (scores.length - 1)) * (W - PAD * 2),
      H - PAD - ((s - min) / range) * (H - PAD * 2 - 24),
    ])

    const peakIdx = scores.indexOf(hi)
    const peakDate = new Date(ordered[peakIdx].completed_at)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    const line = smoothPath(pts)
    return {
      line,
      area: `${line} L ${pts[pts.length - 1][0]} ${H - PAD} L ${pts[0][0]} ${H - PAD} Z`,
      peak: { x: pts[peakIdx][0], y: pts[peakIdx][1], score: hi, date: peakDate },
    }
  }, [sessions])

  if (!chart) {
    return (
      <div className="h-[190px] flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
          Complete a couple of drills and your score curve will appear here.
        </p>
      </div>
    )
  }

  const { line, area, peak } = chart
  // Chip is HTML (not SVG text) so it never stretches with preserveAspectRatio="none"
  const chipLeft = `${Math.min(88, Math.max(2, (peak.x / W) * 100))}%`

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-[190px] block"
        role="img"
        aria-label="Session scores over time"
      >
        <defs>
          <linearGradient id="score-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3f6dff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#3f6dff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="score-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--color-brand-grad-b)" />
            <stop offset="0.5" stopColor="var(--color-brand-cyan)" />
            <stop offset="1" stopColor="var(--color-brand-teal)" />
          </linearGradient>
        </defs>

        {[1, 2, 3].map(g => {
          const y = PAD + (g / 4) * (H - PAD * 2)
          return (
            <line
              key={g}
              x1={PAD} x2={W - PAD} y1={y} y2={y}
              stroke="rgba(99,130,210,0.09)"
              strokeDasharray="3 5"
            />
          )
        })}

        <path d={area} fill="url(#score-area)" className="chart-area-fade" />
        <path
          d={line}
          fill="none"
          stroke="url(#score-stroke)"
          strokeWidth="2.4"
          strokeLinecap="round"
          pathLength="1"
          className="chart-draw"
          style={{ filter: 'drop-shadow(0 0 8px rgba(72,118,255,0.7))' }}
        />

        <g className="chart-peak-fade">
          <line
            x1={peak.x} x2={peak.x} y1={peak.y} y2={H - PAD}
            stroke="rgba(79,168,255,0.35)"
            strokeDasharray="2 4"
          />
          <circle cx={peak.x} cy={peak.y} r="8" fill="rgba(79,168,255,0.2)" />
          <circle
            cx={peak.x} cy={peak.y} r="3.4" fill="#fff"
            style={{ filter: 'drop-shadow(0 0 6px var(--color-brand-cyan))' }}
          />
        </g>
      </svg>

      <div
        className="chart-peak-fade absolute flex items-baseline gap-1.5 px-2.5 py-1 rounded-lg pointer-events-none"
        style={{
          left: chipLeft,
          top: Math.max(2, peak.y - 38),
          background: '#1b2547',
          border: '1px solid rgba(99,130,210,0.3)',
        }}
      >
        <span className="text-xs font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>
          {peak.score} pts
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-brand-muted)' }}>
          {peak.date}
        </span>
      </div>
    </div>
  )
}
