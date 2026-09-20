// Animated American / European roulette wheel.
//
// The engine decides the winning pocket first; this component only animates
// toward it. The ball never picks the number — it is told where to land, so
// what an agent sees always matches what the table settles.
//
// Angles are degrees clockwise from 12 o'clock. The ball comes to rest at the
// top, under the marker, so the winning number is unambiguous to read.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { WHEELS, colorOf, pocketAngle, pocketCount, key } from '../lib/rouletteGame'

const R_RIM     = 150
const R_TRACK   = 131   // ball's outer running track
const R_POCKET  = 112   // outer edge of the pockets
const R_INNER   = 76    // inner edge of the pockets
const R_BALL_IN = 103   // ball's resting radius — against the pocket's outer
                        // wall, as it sits on a real wheel, which also keeps
                        // it from covering the winning number
const BALL_R    = 6.5

const SPIN_MS      = 5200
const ROTOR_TURNS  = 5
const BALL_TURNS   = 13

const POCKET_FILL = { red: '#c1272d', black: '#16181d', green: '#12794a' }

// Polar (degrees clockwise from top) → cartesian, centre at 0,0.
const pt = (r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return [r * Math.cos(rad), r * Math.sin(rad)]
}

// Annular wedge path between two radii, spanning a0→a1 degrees.
function wedge(r0, r1, a0, a1) {
  const [x0, y0] = pt(r1, a0)
  const [x1, y1] = pt(r1, a1)
  const [x2, y2] = pt(r0, a1)
  const [x3, y3] = pt(r0, a0)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} `
       + `L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`
}

const easeOutQuart = t => 1 - Math.pow(1 - t, 4)
const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }
  catch { return false }
}

export default function RouletteWheel({
  wheel = 'american', winner = null, spinId = 0, onSettled, dim = false,
}) {
  const rotorRef = useRef(null)
  const ballRef  = useRef(null)
  const rafRef   = useRef(0)
  const stateRef = useRef({ rotor: 0, ball: 0 })
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled

  const pockets = WHEELS[wheel]
  const n       = pocketCount(wheel)
  const step    = 360 / n

  // Paint the current rotor/ball position without going through React state —
  // this runs every frame, and a re-render per frame would be wasteful.
  const paint = () => {
    const { rotor, ball, ballR = R_TRACK } = stateRef.current
    if (rotorRef.current) rotorRef.current.setAttribute('transform', `rotate(${rotor})`)
    if (ballRef.current) {
      const [x, y] = pt(ballR, ball)
      ballRef.current.setAttribute('cx', x)
      ballRef.current.setAttribute('cy', y)
    }
  }

  useLayoutEffect(paint, [])

  useEffect(() => {
    if (!spinId || winner == null) return
    cancelAnimationFrame(rafRef.current)

    const P = pocketAngle(winner, wheel)
    const from = stateRef.current

    // Land the winning pocket at 12 o'clock: rotor ends at -P (mod 360).
    const target    = ((-P % 360) + 360) % 360
    const startNorm = ((from.rotor % 360) + 360) % 360
    const rotorEnd  = from.rotor + ROTOR_TURNS * 360 + (((target - startNorm) % 360) + 360) % 360

    // Ball runs the other way and finishes at the top (0 mod 360).
    const ballEnd = from.ball - BALL_TURNS * 360 - (((from.ball % 360) + 360) % 360)

    const rotorFrom = from.rotor
    const ballFrom  = from.ball

    if (prefersReducedMotion()) {
      stateRef.current = { rotor: rotorEnd, ball: ballEnd, ballR: R_BALL_IN }
      paint()
      settledRef.current?.()
      return
    }

    const t0 = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / SPIN_MS)
      const e = easeOutQuart(t)

      const rotor = rotorFrom + (rotorEnd - rotorFrom) * e
      const ball  = ballFrom + (ballEnd - ballFrom) * easeOutQuart(Math.min(1, t * 1.02))

      // The ball rides the outer track, then drops into the pockets over the
      // last stretch, with a couple of damped hops off the frets.
      let ballR = R_TRACK
      if (t > 0.55) {
        const d = (t - 0.55) / 0.45
        const hop = Math.sin(d * Math.PI * 3) * (1 - d) * 7
        ballR = R_TRACK + (R_BALL_IN - R_TRACK) * easeInOutSine(d) + hop
      }

      stateRef.current = { rotor, ball, ballR }
      paint()

      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else {
        stateRef.current = { rotor: rotorEnd, ball: ballEnd, ballR: R_BALL_IN }
        paint()
        settledRef.current?.()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // Re-runs only when a new spin is requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId])

  return (
    <svg viewBox="-160 -160 320 320" className="w-full h-full block"
      style={{ maxHeight: 340, opacity: dim ? 0.55 : 1, transition: 'opacity 200ms ease-out' }}>
      <defs>
        <radialGradient id="rw-bowl" cx="50%" cy="38%">
          <stop offset="0%"   stopColor="#3b2a1a" />
          <stop offset="70%"  stopColor="#22160d" />
          <stop offset="100%" stopColor="#140c07" />
        </radialGradient>
        <linearGradient id="rw-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e3c87d" />
          <stop offset="50%"  stopColor="#a7842f" />
          <stop offset="100%" stopColor="#6d5320" />
        </linearGradient>
        <radialGradient id="rw-hub" cx="42%" cy="34%">
          <stop offset="0%"   stopColor="#f2e2b0" />
          <stop offset="55%"  stopColor="#b7913c" />
          <stop offset="100%" stopColor="#6a5122" />
        </radialGradient>
        <radialGradient id="rw-ball" cx="36%" cy="32%">
          <stop offset="0%"   stopColor="#ffffff" />
          <stop offset="70%"  stopColor="#e2e2dc" />
          <stop offset="100%" stopColor="#a9a9a2" />
        </radialGradient>
      </defs>

      {/* Bowl + rim */}
      <circle r={R_RIM} fill="url(#rw-rim)" />
      <circle r={R_RIM - 8} fill="url(#rw-bowl)" />
      <circle r={R_TRACK + 7} fill="none" stroke="#0c0906" strokeWidth={1.5} opacity={0.8} />

      {/* Rotor — pockets, frets and hub all turn together */}
      <g ref={rotorRef}>
        <circle r={R_POCKET + 2} fill="#0f0a06" />
        {pockets.map((p, i) => {
          const a = i * step
          const [tx, ty] = pt((R_POCKET + R_INNER) / 2, a)
          return (
            <g key={key(p)}>
              <path d={wedge(R_INNER, R_POCKET, a - step / 2, a + step / 2)}
                fill={POCKET_FILL[colorOf(p)]} stroke="#d9c27e" strokeWidth={0.6} />
              <text x={tx} y={ty} transform={`rotate(${a} ${tx} ${ty})`}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={n > 37 ? 9.5 : 10} fontWeight="700" fill="#fff"
                fontFamily="var(--font-mono, monospace)">
                {p}
              </text>
            </g>
          )
        })}
        {/* Frets between pockets */}
        {pockets.map((p, i) => {
          const a = i * step - step / 2
          const [x0, y0] = pt(R_INNER, a)
          const [x1, y1] = pt(R_POCKET, a)
          return <line key={`f${key(p)}`} x1={x0} y1={y0} x2={x1} y2={y1}
            stroke="#e6d49a" strokeWidth={0.9} opacity={0.85} />
        })}
        {/* Turret */}
        <circle r={R_INNER} fill="url(#rw-hub)" stroke="#5c451c" strokeWidth={1.5} />
        <circle r={R_INNER * 0.62} fill="#1b1207" opacity={0.35} />
        <ellipse rx={R_INNER * 0.5} ry={R_INNER * 0.16} fill="#e9d59c" opacity={0.5} />
        <ellipse rx={R_INNER * 0.16} ry={R_INNER * 0.5} fill="#e9d59c" opacity={0.5} />
        <circle r={7} fill="#f4e6bb" stroke="#6a5122" strokeWidth={1} />
      </g>

      {/* Ball */}
      <circle ref={ballRef} r={BALL_R} fill="url(#rw-ball)"
        stroke="#7c7c74" strokeWidth={0.5} cx={0} cy={-R_TRACK} />

      {/* Marker at 12 o'clock — the ball settles here */}
      <path d={`M 0 ${-R_RIM + 2} l -7 -11 l 14 0 Z`} fill="var(--color-brand-gold, #d4a843)" />
    </svg>
  )
}
