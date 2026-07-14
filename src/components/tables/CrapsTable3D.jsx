/**
 * CrapsTable3D.jsx — 3D half craps layout for payout drills.
 *
 * Models the dealer's half of a craps table: the point/box numbers,
 * Come, Field, Don't Come, Don't Pass Bar, the Pass Line, and the
 * center Proposition / Hardways block. The wagered chip stack sits on
 * the band the question is about (`activeBet`: 'line' | 'field' |
 * 'center'), which is highlighted in gold. Camera movement is bounded
 * by TableControls so the table can't be rotated under or dragged off.
 */
import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import TableControls from './TableControls'
import labelFont from '../../assets/label.ttf'

// ── Layout space (matches the 2D half-table proportions) ──────────
const LW = 520, LH = 300
const SCALE = 0.011

function toWorld(cx, cy) {
  return [(cx - LW / 2) * SCALE, (cy - LH / 2) * SCALE]
}

const CHIP_COLOR_HEX = {
  White:  '#e5e7eb',
  Red:    '#dc2626',
  Green:  '#16a34a',
  Black:  '#1c1917',
  Purple: '#7c3aed',
  Pink:   '#db2777',
}

// ── Felt base ─────────────────────────────────────────────────────
function Felt() {
  const w = LW * SCALE + 0.4
  const d = LH * SCALE + 0.4
  return (
    <>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[w + 0.3, 0.08, d + 0.3]} />
        <meshStandardMaterial color="#3a2410" roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[0, -0.01, 0]} receiveShadow>
        <boxGeometry args={[w, 0.04, d]} />
        <meshStandardMaterial color="#15441a" roughness={0.95} />
      </mesh>
    </>
  )
}

const CELL_BORDER = 0.014

// A labelled felt cell positioned by rect (x, y, w, h) in layout units.
function Cell({ x, y, w, h, label, fontSize = 13, active = false, fill = '#1e4e1e' }) {
  const cx = x + w / 2
  const cy = y + h / 2
  const [wx, wz] = toWorld(cx, cy)
  const fullW = w * SCALE
  const fullD = h * SCALE
  const innerW = Math.max(0.02, fullW - CELL_BORDER * 2)
  const innerD = Math.max(0.02, fullD - CELL_BORDER * 2)
  const topColor = active ? '#2d5a2d' : fill
  return (
    <group position={[wx, 0.012, wz]}>
      {/* Border underplate — gold when active, cream otherwise */}
      <mesh receiveShadow>
        <boxGeometry args={[fullW, 0.012, fullD]} />
        <meshStandardMaterial color={active ? '#fbbf24' : '#e8e2cf'} roughness={0.5} />
      </mesh>
      {/* Colored top */}
      <mesh position={[0, 0.013, 0]} receiveShadow>
        <boxGeometry args={[innerW, 0.012, innerD]} />
        <meshStandardMaterial
          color={topColor}
          roughness={0.7}
          emissive={active ? '#3a2f05' : '#000000'}
          emissiveIntensity={active ? 0.8 : 0} />
      </mesh>
      <Text
        font={labelFont}
        position={[0, 0.024, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={fontSize * SCALE}
        color={active ? '#fbbf24' : '#d1fae5'}
        anchorX="center"
        anchorY="middle"
        maxWidth={innerW * 0.95}
        textAlign="center"
        outlineWidth={0.0004}
        outlineColor="#062010"
      >
        {label}
      </Text>
    </group>
  )
}

// ── Chip stack ────────────────────────────────────────────────────
const CHIP_HEIGHT = 0.02

function ChipStack({ chips, cx, cy }) {
  if (!chips || chips.length === 0) return null
  const [x, z] = toWorld(cx, cy)

  // Flatten to individual discs (largest denom at the bottom), cap the height.
  const discs = []
  for (const c of chips) {
    for (let i = 0; i < Math.min(c.count, 4); i++) {
      discs.push({ color: c.color, denomination: c.denomination })
    }
  }
  const visible = discs.slice(0, 8)
  const top = visible[visible.length - 1]
  const topLabel = top.denomination >= 1000 ? `${top.denomination / 1000}K` : `$${top.denomination}`

  return (
    <group position={[x, 0.045, z]}>
      {visible.map((disc, i) => {
        const hex = CHIP_COLOR_HEX[disc.color] || '#dc2626'
        return (
          <mesh key={i} position={[0, i * CHIP_HEIGHT, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, CHIP_HEIGHT, 32]} />
            <meshStandardMaterial color={hex} metalness={0.15} roughness={0.45} />
          </mesh>
        )
      })}
      <Text
        font={labelFont}
        position={[0, (visible.length - 1) * CHIP_HEIGHT + CHIP_HEIGHT / 2 + 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.085}
        color={top.color === 'White' ? '#111827' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {topLabel}
      </Text>
    </group>
  )
}

// ── Scene ─────────────────────────────────────────────────────────
function Scene({ chips, activeBet }) {
  const lineOn   = activeBet === 'line'
  const fieldOn  = activeBet === 'field'
  const centerOn = activeBet === 'center'

  const boxNums = ['4', '5', 'SIX', '8', 'NINE', '10']
  const boxX0 = 120, boxW = (LW - boxX0) / 6, boxY = 30, boxH = 46

  // Chip stack position for the active band
  const stackPos = lineOn
    ? { cx: (boxX0 + LW) / 2, cy: 258 }   // Pass Line
    : fieldOn
      ? { cx: (boxX0 + LW) / 2, cy: 178 } // Field
      : { cx: 64, cy: 176 }               // Center props/hardways

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 7, 4]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 5, -3]} intensity={0.35} />
      <pointLight position={[0, 4, 0]} intensity={0.4} color="#fbbf24" />

      <Felt />

      {/* Point / box numbers (Place, Buy, Odds, point) */}
      {boxNums.map((n, i) => (
        <Cell key={n} x={boxX0 + i * boxW} y={boxY} w={boxW - 3} h={boxH}
          label={n} fontSize={17} active={lineOn} fill="#1c3a1c" />
      ))}

      {/* Don't Come (top-left) */}
      <Cell x={10} y={boxY} w={102} h={boxH + 34} label={"DON'T\nCOME"} fontSize={11}
        active={lineOn} fill="#183018" />

      {/* Come */}
      <Cell x={boxX0} y={82} w={LW - boxX0} h={64} label="COME" fontSize={16}
        active={lineOn} fill="#173417" />

      {/* Center — Propositions & Hardways */}
      <Cell x={10} y={124} w={102} h={104} label={"PROPS\n·\nHARDWAYS"} fontSize={10}
        active={centerOn} fill="#122a12" />

      {/* Field */}
      <Cell x={boxX0} y={152} w={LW - boxX0} h={46}
        label="FIELD · 2 3 4 9 10 11 12" fontSize={12} active={fieldOn} fill="#173417" />

      {/* Don't Pass Bar */}
      <Cell x={boxX0} y={204} w={LW - boxX0} h={26} label="DON'T PASS BAR" fontSize={11}
        active={lineOn} fill="#142c14" />

      {/* Pass Line (full width, along the bottom) */}
      <Cell x={10} y={236} w={LW - 20} h={52} label="PASS LINE" fontSize={18}
        active={lineOn} fill="#1a3f1a" />

      {/* Wagered chip stack on the active band */}
      <ChipStack chips={chips} cx={stackPos.cx} cy={stackPos.cy} />
    </>
  )
}

// ── Wrapper ───────────────────────────────────────────────────────
export default function CrapsTable3D({ chips, activeBet = 'line' }) {
  const controlsRef = useRef()
  const handleReset = () => { if (controlsRef.current) controlsRef.current.reset() }

  return (
    <div className="relative w-full"
      style={{ aspectRatio: '16 / 9', minHeight: 340, background: '#06120a' }}>
      <Canvas camera={{ position: [0, 3.4, 3.6], fov: 50, near: 0.1, far: 100 }} shadows dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Scene chips={chips} activeBet={activeBet} />
        </Suspense>
        <TableControls controlsRef={controlsRef} panLimit={1.4} />
      </Canvas>

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
