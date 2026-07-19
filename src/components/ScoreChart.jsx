import { useEffect, useMemo, useRef, useState } from 'react'

const W = 720
const H = 190
const PAD = 14
const HIDE_AFTER_MS = 20_000
const FADE_MS = 600

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
 * The marker chip is hidden until the agent clicks (or drags across) the
 * line — it shows that session's score, date, and time, follows further
 * clicks/drags/arrow keys, and fades away after 20 seconds of inactivity.
 */
export default function ScoreChart({ sessions }) {
  const svgRef = useRef(null)
  const hideTimer = useRef(null)
  const [selected, setSelected] = useState(null)  // null = nothing shown
  const [visible,  setVisible]  = useState(false)

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

    const line = smoothPath(pts)
    return {
      pts,
      scores,
      dates: ordered.map(s => s.completed_at),
      line,
      area: `${line} L ${pts[pts.length - 1][0]} ${H - PAD} L ${pts[0][0]} ${H - PAD} Z`,
    }
  }, [sessions])

  useEffect(() => () => clearTimeout(hideTimer.current), [])

  if (!chart) {
    return (
      <div className="h-[190px] flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
          Complete a couple of drills and your score curve will appear here.
        </p>
      </div>
    )
  }

  const count = chart.pts.length

  // Any interaction shows the marker and restarts the 20s inactivity fade
  const touch = (idx) => {
    setSelected(idx)
    setVisible(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS)
  }

  // Map a pointer position to the nearest session point (svg is stretched, so
  // convert through the rendered width rather than viewBox units directly)
  const pickNearest = (clientX) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const x = ((clientX - rect.left) / rect.width) * W
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < count; i++) {
      const d = Math.abs(chart.pts[i][0] - x)
      if (d < bestDist) { bestDist = d; best = i }
    }
    touch(best)
  }

  const onKeyDown = (e) => {
    const cur = selected ?? count - 1
    let next = null
    if (e.key === 'ArrowLeft')  next = Math.max(0, cur - (selected === null ? 0 : 1))
    if (e.key === 'ArrowRight') next = Math.min(count - 1, cur + (selected === null ? 0 : 1))
    if (e.key === 'Home')       next = 0
    if (e.key === 'End')        next = count - 1
    if (e.key === 'Escape')     { setVisible(false); return }
    if (next === null) return
    e.preventDefault()
    touch(next)
  }

  const hasSelection = selected !== null
  const [px, py] = hasSelection ? chart.pts[selected] : [0, 0]
  const when = hasSelection ? new Date(chart.dates[selected]) : null
  const dateLabel = when?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeLabel = when?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  // Marker/chip fade with visibility; chip is HTML so it never stretches
  const fadeStyle = {
    opacity: visible ? 1 : 0,
    transition: `opacity ${FADE_MS}ms ease, left 160ms ease-out, top 160ms ease-out`,
    pointerEvents: 'none',
  }
  const chipLeft = `${Math.min(84, Math.max(2, (px / W) * 100))}%`

  return (
    <div
      className="relative"
      tabIndex={0}
      role="group"
      aria-label={
        hasSelection && visible
          ? `Score chart, ${count} sessions. Selected: ${chart.scores[selected]} points on ${dateLabel} at ${timeLabel}. Use arrow keys to move between sessions.`
          : `Score chart, ${count} sessions. Click the line or press arrow keys to inspect a session.`
      }
      onKeyDown={onKeyDown}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-[190px] block"
        style={{ cursor: 'pointer', touchAction: 'pan-y' }}
        onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); pickNearest(e.clientX) }}
        onPointerMove={e => { if (e.buttons === 1) pickNearest(e.clientX) }}
        aria-hidden="true"
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

        <path d={chart.area} fill="url(#score-area)" className="chart-area-fade" />
        <path
          d={chart.line}
          fill="none"
          stroke="url(#score-stroke)"
          strokeWidth="2.4"
          strokeLinecap="round"
          pathLength="1"
          className="chart-draw"
          style={{ filter: 'drop-shadow(0 0 8px rgba(72,118,255,0.7))' }}
        />

        {/* Session dots — always-visible click targets */}
        <g className="chart-area-fade">
          {chart.pts.map(([x, y], i) => (
            (!hasSelection || i !== selected || !visible) && (
              <circle key={i} cx={x} cy={y} r="2.2" fill="rgba(79,168,255,0.4)" />
            )
          ))}
        </g>

        {hasSelection && (
          <g style={fadeStyle}>
            <line
              x1={px} x2={px} y1={py} y2={H - PAD}
              stroke="rgba(79,168,255,0.35)"
              strokeDasharray="2 4"
            />
            <circle cx={px} cy={py} r="8" fill="rgba(79,168,255,0.2)" />
            <circle
              cx={px} cy={py} r="3.4" fill="#fff"
              style={{ filter: 'drop-shadow(0 0 6px var(--color-brand-cyan))' }}
            />
          </g>
        )}
      </svg>

      {hasSelection && (
        <div
          className="absolute flex items-baseline gap-1.5 px-2.5 py-1 rounded-lg"
          style={{
            ...fadeStyle,
            left: chipLeft,
            top: Math.max(2, py - 38),
            background: '#1b2547',
            border: '1px solid rgba(99,130,210,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="text-xs font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>
            {chart.scores[selected]} pts
          </span>
          <span className="text-[10px]" style={{ color: 'var(--color-brand-muted)' }}>
            {dateLabel} · {timeLabel}
          </span>
        </div>
      )}
    </div>
  )
}
