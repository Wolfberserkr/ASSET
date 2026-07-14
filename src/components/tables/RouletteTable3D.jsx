/**
 * RouletteTable3D.jsx — 3D Roulette table for payout drills.
 *
 * Renders the same scenario data that the 2D SVG version uses
 * (see lib/rouletteScenario.js). Drag to rotate, scroll to zoom,
 * right-click drag to pan. A blue pulsing marker sits above the
 * winning number. Camera movement is bounded by TableControls so the
 * table can't be rotated under or dragged off-screen.
 */
import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { ZW, CW, CH, RED_NUMS } from '../../lib/rouletteScenario'
import TableControls from './TableControls'
import labelFont from '../../assets/label.ttf'

const SVG_W = ZW + CW * 12 + 40
const SVG_H = CH * 3 + 60 + 40
const SCALE = 0.012

function toWorld(cx, cy) {
  return [(cx - SVG_W / 2) * SCALE, (cy - SVG_H / 2) * SCALE]
}

const CHIP_COLOR_HEX = {
  White:  '#e5e7eb',
  Red:    '#dc2626',
  Green:  '#16a34a',
  Black:  '#1c1917',
  Purple: '#7c3aed',
  Pink:   '#db2777',
}

// ───────────────────────────────────────────────────────────
// Cell primitives
// ───────────────────────────────────────────────────────────

function Felt() {
  const w = SVG_W * SCALE + 0.4
  const d = SVG_H * SCALE + 0.4
  return (
    <>
      {/* Outer frame */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[w + 0.3, 0.08, d + 0.3]} />
        <meshStandardMaterial color="#3a2410" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Felt */}
      <mesh position={[0, -0.01, 0]} receiveShadow>
        <boxGeometry args={[w, 0.04, d]} />
        <meshStandardMaterial color="#15441a" roughness={0.95} />
      </mesh>
    </>
  )
}

const CELL_BORDER = 0.012  // ~12mm white border on each side

function Cell({ cx, cy, w, d, color, label, fontSize, labelColor = 'white' }) {
  const [x, z] = toWorld(cx, cy)
  const fullW = w * SCALE
  const fullD = d * SCALE
  const innerW = Math.max(0.02, fullW - CELL_BORDER * 2)
  const innerD = Math.max(0.02, fullD - CELL_BORDER * 2)
  return (
    <group position={[x, 0.012, z]}>
      {/* White underplate — shows as a border around the colored top */}
      <mesh receiveShadow>
        <boxGeometry args={[fullW, 0.012, fullD]} />
        <meshStandardMaterial color="#ffffff" roughness={0.55} />
      </mesh>
      {/* Colored cell on top */}
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <boxGeometry args={[innerW, 0.012, innerD]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <Text
        font={labelFont}
        position={[0, 0.022, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={fontSize * SCALE}
        color={labelColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.0005}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  )
}

// ───────────────────────────────────────────────────────────
// Chips
// ───────────────────────────────────────────────────────────

const CHIP_HEIGHT = 0.015  // ~15mm thick — slim enough to stack cleanly

function Chip({ cx, cy, color, label }) {
  const [x, z] = toWorld(cx, cy)
  const hex = CHIP_COLOR_HEX[color] || '#dc2626'
  const textColor = color === 'White' ? '#111827' : '#ffffff'
  const topY = CHIP_HEIGHT / 2

  return (
    <group position={[x, 0.040, z]}>
      {/* Main disc */}
      <mesh castShadow>
        <cylinderGeometry args={[0.12, 0.12, CHIP_HEIGHT, 32]} />
        <meshStandardMaterial color={hex} metalness={0.15} roughness={0.45} />
      </mesh>
      {/* Inner ring (decorative, sits just on top of the disc) */}
      <mesh position={[0, topY + 0.0005, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 0.0008, 32]} />
        <meshStandardMaterial color={hex} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Denomination label */}
      <Text
        font={labelFont}
        position={[0, topY + 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.075}
        color={textColor}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {label}
      </Text>
    </group>
  )
}

// ───────────────────────────────────────────────────────────
// Winning marker (pulsing blue sphere)
// ───────────────────────────────────────────────────────────

function WinningMarker({ cx, cy }) {
  const ref = useRef()
  const [x, z] = toWorld(cx, cy)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    ref.current.position.y = 0.32 + Math.sin(t * 2.5) * 0.05
    const s = 1 + Math.sin(t * 2.5) * 0.08
    ref.current.scale.set(s, s, s)
  })

  return (
    <group>
      {/* Glowing core */}
      <mesh ref={ref} position={[x, 0.32, z]}>
        <sphereGeometry args={[0.075, 32, 32]} />
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#1d4ed8"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      {/* Vertical beam connecting to the number */}
      <mesh position={[x, 0.16, z]}>
        <cylinderGeometry args={[0.005, 0.005, 0.32, 8]} />
        <meshStandardMaterial
          color="#93c5fd"
          emissive="#3b82f6"
          emissiveIntensity={1.0}
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// ───────────────────────────────────────────────────────────
// Scene
// ───────────────────────────────────────────────────────────

function cellOf(n) {
  const col = Math.floor((n - 1) / 3)
  const row = 2 - ((n - 1) % 3)
  return {
    cx: ZW + col * CW + CW / 2,
    cy: row * CH + CH / 2,
  }
}

function Scene({ scenario }) {
  const { bets, winningNumber } = scenario
  const winStr = String(winningNumber)

  const rows = [
    [3,6,9,12,15,18,21,24,27,30,33,36],
    [2,5,8,11,14,17,20,23,26,29,32,35],
    [1,4,7,10,13,16,19,22,25,28,31,34],
  ]

  const GRID_W = CW * 12
  const dozW = GRID_W / 3
  const evenW = GRID_W / 6

  // Determine winning cell position
  let winPos = null
  if (winStr === '0')        winPos = { cx: ZW / 2, cy: CH * 2.25 }
  else if (winStr === '00')  winPos = { cx: ZW / 2, cy: CH * 0.75 }
  else if (+winStr >= 1 && +winStr <= 36) winPos = cellOf(+winStr)

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 7, 4]} intensity={1.0} castShadow
        shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 5, -3]} intensity={0.35} />
      <pointLight position={[0, 4, 0]} intensity={0.4} color="#fbbf24" />

      <Felt />

      {/* 00 cell */}
      <Cell cx={ZW / 2} cy={CH * 0.75} w={ZW} d={CH * 1.5}
        color="#16a34a" label="00" fontSize={20} />

      {/* 0 cell */}
      <Cell cx={ZW / 2} cy={CH * 2.25} w={ZW} d={CH * 1.5}
        color="#16a34a" label="0" fontSize={20} />

      {/* Number cells 1–36 */}
      {rows.flatMap(row =>
        row.map(n => {
          const c = cellOf(n)
          return (
            <Cell key={n} cx={c.cx} cy={c.cy} w={CW} d={CH}
              color={RED_NUMS.has(n) ? '#dc2626' : '#1c1917'}
              label={String(n)} fontSize={16} />
          )
        })
      )}

      {/* Dozen bets */}
      {['1st 12', '2nd 12', '3rd 12'].map((label, i) => (
        <Cell key={label}
          cx={ZW + i * dozW + dozW / 2}
          cy={CH * 3 + 20}
          w={dozW} d={40}
          color="#1e4e1e" label={label} fontSize={11} />
      ))}

      {/* Even-money bets */}
      {[
        { label: '1-18',  color: '#1e4e1e' },
        { label: 'EVEN',  color: '#1e4e1e' },
        { label: 'RED',   color: '#991b1b' },
        { label: 'BLACK', color: '#1c1917' },
        { label: 'ODD',   color: '#1e4e1e' },
        { label: '19-36', color: '#1e4e1e' },
      ].map((b, i) => (
        <Cell key={b.label}
          cx={ZW + i * evenW + evenW / 2}
          cy={CH * 3 + 60}
          w={evenW} d={40}
          color={b.color} label={b.label} fontSize={11} />
      ))}

      {/* 2:1 column labels */}
      {[0, 1, 2].map(r => (
        <Cell key={r}
          cx={ZW + GRID_W + 19}
          cy={r * CH + CH / 2}
          w={38} d={CH}
          color="#1e4e1e" label="2:1" fontSize={11} />
      ))}

      {/* Chips */}
      {bets.map((bet, i) => {
        const label = bet.chip.denomination >= 1000
          ? `${bet.chip.denomination / 1000}K`
          : `$${bet.chip.denomination}`
        return (
          <Chip key={i} cx={bet.cx} cy={bet.cy}
            color={bet.chip.color} label={label} />
        )
      })}

      {/* Winning marker */}
      {winPos && <WinningMarker cx={winPos.cx} cy={winPos.cy} />}
    </>
  )
}

// ───────────────────────────────────────────────────────────
// Wrapper with Canvas + controls
// ───────────────────────────────────────────────────────────

export default function RouletteTable3D({ scenario }) {
  const controlsRef = useRef()

  const handleReset = () => {
    if (controlsRef.current) controlsRef.current.reset()
  }

  return (
    <div className="relative w-full"
      style={{ aspectRatio: '16 / 9', minHeight: 340, background: '#06120a' }}>
      <Canvas
        camera={{ position: [0, 3.2, 3.4], fov: 50, near: 0.1, far: 100 }}
        shadows
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Scene scenario={scenario} />
        </Suspense>
        <TableControls controlsRef={controlsRef} panLimit={1.4} />
      </Canvas>

      {/* Reset View button */}
      <button
        onClick={handleReset}
        className="absolute top-2 right-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-opacity hover:opacity-90"
        style={{
          background: 'rgba(0, 0, 0, 0.55)',
          color: '#fbbf24',
          border: '1px solid rgba(251, 191, 36, 0.5)',
          backdropFilter: 'blur(4px)',
        }}
      >
        Reset View
      </button>

      {/* Controls hint */}
      <div
        className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md text-xs font-mono pointer-events-none"
        style={{
          background: 'rgba(0, 0, 0, 0.55)',
          color: '#86efac',
          backdropFilter: 'blur(4px)',
        }}
      >
        Drag: rotate · Scroll: zoom · Right-click: pan
      </div>
    </div>
  )
}
