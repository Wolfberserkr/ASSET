import { useEffect, useRef, useCallback } from 'react'

/**
 * CircuitBackground — dense PCB-style animated background.
 *
 * Inspired by high-tech HUD circuit aesthetics:
 *  • Dense orthogonal traces on a tight grid
 *  • Square junction dots & SMD pads
 *  • Scattered IC chip blocks with pin arrays
 *  • Dot-matrix zones (clusters of evenly-spaced small squares)
 *  • Mouse-following HUD ring with rotating arc segments
 *  • Signal pulses racing along lit traces
 *  • Ambient radial glow under the cursor
 */

const GOLD    = '212, 175, 55'
const CELL    = 48            // tight grid pitch for density
const GLOW_R  = 180           // cursor influence radius
const DECAY   = 0.014
const MAX_P   = 40            // max simultaneous pulses

export default function CircuitBackground({ className = '' }) {
  const canvasRef = useRef(null)
  const mouseRef  = useRef({ x: -9999, y: -9999 })
  const rafRef    = useRef(null)
  const lastTRef  = useRef(0)
  const rotRef    = useRef(0)   // HUD ring rotation angle
  const phaseRef  = useRef(0)   // centre pulse breathing phase

  const buildGraph = useCallback((w, h) => {
    const COLS = Math.ceil(w / CELL) + 2
    const ROWS = Math.ceil(h / CELL) + 2

    // ── nodes on sparse grid ─────────────────────────────────────
    const grid  = {}
    const nodes = []

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (Math.random() < 0.08) continue   // sparse: skip ~8%

        const roll  = Math.random()
        // 'chip' = large IC block, 'dotblock' = dot-matrix zone, 'pad' = SMD pad, 'via' = junction
        const type  = roll < 0.04 ? 'chip'
                    : roll < 0.09 ? 'dotblock'
                    : roll < 0.26 ? 'pad'
                    : 'via'

        grid[`${r},${c}`] = nodes.length
        nodes.push({
          x:    c * CELL,
          y:    r * CELL,
          type,
          glow: 0,
        })
      }
    }

    // ── edges (orthogonal only) ───────────────────────────────────
    const adj   = nodes.map(() => [])
    const edges = []

    const link = (aI, bI) => {
      const eI = edges.length
      edges.push({ a: aI, b: bI, glow: 0, wide: Math.random() < 0.15 })
      adj[aI].push(eI)
      adj[bI].push(eI)
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const aI = grid[`${r},${c}`]
        if (aI === undefined) continue
        const rI = grid[`${r},${c + 1}`]
        if (rI !== undefined && Math.random() < 0.65) link(aI, rI)
        const dI = grid[`${r + 1},${c}`]
        if (dI !== undefined && Math.random() < 0.65) link(aI, dI)
      }
    }

    // ── IC chip packages ──────────────────────────────────────────
    const chips = nodes
      .map((n, i) => n.type === 'chip' ? { nodeIdx: i, x: n.x, y: n.y,
        cw: 44 + Math.floor(Math.random() * 4) * 8,
        ch: 28 + Math.floor(Math.random() * 2) * 8,
        pins: 3 + Math.floor(Math.random() * 4),
      } : null)
      .filter(Boolean)

    // ── dot-matrix clusters ───────────────────────────────────────
    const dotblocks = nodes
      .map((n, i) => n.type === 'dotblock' ? {
        nodeIdx: i,
        x: n.x, y: n.y,
        cols: 3 + Math.floor(Math.random() * 3),
        rows: 2 + Math.floor(Math.random() * 3),
      } : null)
      .filter(Boolean)

    return { nodes, edges, chips, dotblocks, adj, pulses: [] }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let graph = null
    let W = 0, H = 0

    const resize = () => {
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width  = W
      canvas.height = H
      graph = buildGraph(W, H)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    window.addEventListener('mousemove', onMove)

    // ── draw helpers ──────────────────────────────────────────────
    const sq = (x, y, s) => ctx.rect(x - s / 2, y - s / 2, s, s)

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.arcTo(x + w, y, x + w, y + r, r)
      ctx.lineTo(x + w, y + h - r)
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
      ctx.lineTo(x + r, y + h)
      ctx.arcTo(x, y + h, x, y + h - r, r)
      ctx.lineTo(x, y + r)
      ctx.arcTo(x, y, x + r, y, r)
      ctx.closePath()
    }

    // ── HUD ring draw ─────────────────────────────────────────────
    const drawHUD = (mx, my, rot) => {
      if (mx < 0 || my < 0) return

      // Ambient radial gradient under cursor
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, GLOW_R * 1.2)
      grad.addColorStop(0,   `rgba(${GOLD}, 0.06)`)
      grad.addColorStop(0.5, `rgba(${GOLD}, 0.02)`)
      grad.addColorStop(1,   'transparent')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(mx, my, GLOW_R * 1.2, 0, Math.PI * 2)
      ctx.fill()

      ctx.save()
      ctx.translate(mx, my)

      // Outer ring dashes (slow rotation)
      ctx.rotate(rot)
      ctx.strokeStyle = `rgba(${GOLD}, 0.55)`
      ctx.lineWidth   = 1.5
      ctx.shadowBlur  = 10
      ctx.shadowColor = `rgba(${GOLD}, 0.6)`
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const r1 = 62, r2 = 74
        ctx.beginPath()
        ctx.arc(0, 0, (r1 + r2) / 2, a, a + 0.36)
        ctx.stroke()
      }

      // Inner ring (counter-rotation)
      ctx.rotate(-rot * 2)
      ctx.strokeStyle = `rgba(${GOLD}, 0.35)`
      ctx.lineWidth   = 1
      ctx.shadowBlur  = 6
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(0, 0, 48, a, a + 0.22)
        ctx.stroke()
      }

      // Core dot
      ctx.rotate(rot)  // reset
      ctx.beginPath()
      ctx.arc(0, 0, 4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${GOLD}, 0.8)`
      ctx.shadowBlur = 14
      ctx.fill()

      ctx.restore()
    }

    // ── main loop ─────────────────────────────────────────────────
    const draw = (ts) => {
      if (!graph) { rafRef.current = requestAnimationFrame(draw); return }

      const dt = Math.min((ts - lastTRef.current) / 1000, 0.05)
      lastTRef.current = ts
      rotRef.current  += dt * 0.4          // HUD rotation speed
      phaseRef.current += dt * 0.45        // breathing cycle (~14 s full period)

      ctx.clearRect(0, 0, W, H)

      // ── centre breathing pulse ───────────────────────────────────
      // Very subtle radial glow that slowly expands and contracts
      const pulse = (Math.sin(phaseRef.current) + 1) * 0.5  // 0 → 1 → 0
      const pR    = W * 0.22 + pulse * W * 0.12             // radius breathes
      const pA    = 0.05 + pulse * 0.08                     // max alpha ~0.13
      const grad  = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, pR)
      grad.addColorStop(0,   `rgba(${GOLD}, ${pA})`)
      grad.addColorStop(0.5, `rgba(${GOLD}, ${pA * 0.4})`)
      grad.addColorStop(1,   'transparent')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, pR, 0, Math.PI * 2)
      ctx.fill()

      const { nodes, edges, chips, dotblocks, adj, pulses } = graph
      const { x: mx, y: my } = mouseRef.current

      // ── update node glow ────────────────────────────────────────
      nodes.forEach(n => {
        const d = Math.hypot(n.x - mx, n.y - my)
        if (d < GLOW_R) {
          n.glow = Math.min(1, n.glow + Math.pow(1 - d / GLOW_R, 1.8) * 0.24)
        } else {
          n.glow = Math.max(0, n.glow - DECAY)
        }
      })

      // ── update edge glow ────────────────────────────────────────
      edges.forEach(e => { e.glow = (nodes[e.a].glow + nodes[e.b].glow) * 0.5 })

      // ── draw traces ─────────────────────────────────────────────
      edges.forEach(e => {
        const na = nodes[e.a], nb = nodes[e.b]
        const g  = e.glow
        const tw = e.wide ? 1.8 : 1.0

        ctx.beginPath()
        ctx.moveTo(na.x, na.y)
        ctx.lineTo(nb.x, nb.y)

        if (g < 0.01) {
          ctx.strokeStyle = e.wide
            ? 'rgba(255,255,255,0.09)'
            : 'rgba(255,255,255,0.05)'
          ctx.lineWidth   = tw
          ctx.shadowBlur  = 0
          ctx.stroke()
        } else {
          ctx.save()
          ctx.shadowBlur  = 5 + g * 16
          ctx.shadowColor = `rgba(${GOLD}, ${g * 0.75})`
          ctx.strokeStyle = `rgba(${GOLD}, ${0.15 + g * 0.65})`
          ctx.lineWidth   = tw + g * 2.4
          ctx.stroke()
          ctx.restore()
        }
      })

      // ── spawn pulses ────────────────────────────────────────────
      if (dt > 0 && pulses.length < MAX_P) {
        edges.forEach((e, eI) => {
          if (e.glow > 0.25 && Math.random() < 0.009) {
            pulses.push({ eI, t: 0, dir: Math.random() < 0.5 ? 1 : -1,
              bri: 0.7 + Math.random() * 0.3 })
          }
        })
      }

      // ── advance & draw pulses ───────────────────────────────────
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]
        p.t += 0.55 * dt * (1 + edges[p.eI].glow * 0.5)

        if (p.t >= 1) {
          const endN   = p.dir === 1 ? edges[p.eI].b : edges[p.eI].a
          const nextEs = adj[endN].filter(eI => eI !== p.eI && edges[eI].glow > 0.06)
          if (nextEs.length && Math.random() < 0.75) {
            const nEI = nextEs[Math.floor(Math.random() * nextEs.length)]
            p.eI = nEI; p.t = 0
            p.dir = edges[nEI].a === endN ? 1 : -1
          } else { pulses.splice(i, 1); continue }
        }

        const ce = edges[p.eI]
        const na = nodes[ce.a], nb = nodes[ce.b]
        const ft = p.dir === 1 ? p.t : 1 - p.t
        const px = na.x + (nb.x - na.x) * ft
        const py = na.y + (nb.y - na.y) * ft

        ctx.save()
        ctx.shadowBlur  = 16
        ctx.shadowColor = `rgba(${GOLD}, ${p.bri})`
        ctx.beginPath(); ctx.arc(px, py, 2.0, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 248, 200, ${p.bri})`; ctx.fill()
        ctx.beginPath(); ctx.arc(px, py, 4.0, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${GOLD}, ${p.bri * 0.28})`; ctx.fill()
        ctx.restore()
      }

      // ── draw junction dots & SMD pads ───────────────────────────
      nodes.forEach(n => {
        if (n.type === 'chip' || n.type === 'dotblock') return
        const g     = n.glow
        const isPad = n.type === 'pad'
        const size  = isPad ? 6.5 : 4.0   // square size

        if (g < 0.01) {
          ctx.fillStyle = isPad
            ? 'rgba(255,255,255,0.10)'
            : 'rgba(255,255,255,0.06)'
          ctx.shadowBlur = 0
          ctx.beginPath(); sq(n.x, n.y, size); ctx.fill()

          if (isPad) {
            // inner dot
            ctx.fillStyle = 'rgba(255,255,255,0.04)'
            ctx.beginPath(); sq(n.x, n.y, size * 0.38); ctx.fill()
          }
        } else {
          ctx.save()
          ctx.shadowBlur  = 8 + g * 18
          ctx.shadowColor = `rgba(${GOLD}, ${g})`
          ctx.fillStyle   = `rgba(${GOLD}, ${0.35 + g * 0.65})`
          ctx.beginPath(); sq(n.x, n.y, size + g * 1.5); ctx.fill()
          if (isPad) {
            ctx.fillStyle = `rgba(20, 24, 38, 0.9)`
            ctx.beginPath(); sq(n.x, n.y, (size + g * 1.5) * 0.38); ctx.fill()
          }
          ctx.restore()
        }
      })

      // ── draw dot-matrix clusters ─────────────────────────────────
      dotblocks.forEach(db => {
        const n  = nodes[db.nodeIdx]
        const g  = n.glow
        const gs = 7   // dot spacing
        const ds = 1.4 // dot size

        for (let dr = 0; dr < db.rows; dr++) {
          for (let dc = 0; dc < db.cols; dc++) {
            const dx = db.x + dc * gs - (db.cols - 1) * gs / 2
            const dy = db.y + dr * gs - (db.rows - 1) * gs / 2

            if (g < 0.01) {
              ctx.fillStyle = 'rgba(255,255,255,0.08)'
              ctx.fillRect(dx - ds / 2, dy - ds / 2, ds, ds)
            } else {
              ctx.save()
              ctx.shadowBlur  = 6 + g * 10
              ctx.shadowColor = `rgba(${GOLD}, ${g * 0.8})`
              ctx.fillStyle   = `rgba(${GOLD}, ${0.3 + g * 0.7})`
              ctx.fillRect(dx - ds / 2, dy - ds / 2, ds + g, ds + g)
              ctx.restore()
            }
          }
        }
      })

      // ── draw IC chip packages ────────────────────────────────────
      chips.forEach(chip => {
        const n  = nodes[chip.nodeIdx]
        const g  = n.glow
        const cx = chip.x - chip.cw / 2
        const cy = chip.y - chip.ch / 2

        ctx.save()
        if (g > 0.01) {
          ctx.shadowBlur  = 8 + g * 22
          ctx.shadowColor = `rgba(${GOLD}, ${g * 0.7})`
        }

        // Body
        ctx.fillStyle   = 'rgba(14, 18, 32, 0.94)'
        ctx.strokeStyle = g < 0.01
          ? 'rgba(255,255,255,0.12)'
          : `rgba(${GOLD}, ${0.38 + g * 0.62})`
        ctx.lineWidth = 1.2
        roundRect(cx, cy, chip.cw, chip.ch, 3)
        ctx.fill(); ctx.stroke()

        // Pin-1 corner triangle
        ctx.fillStyle = g < 0.01
          ? 'rgba(255,255,255,0.06)'
          : `rgba(${GOLD}, ${g * 0.4})`
        ctx.beginPath()
        ctx.moveTo(cx + 2, cy + 2)
        ctx.lineTo(cx + 9, cy + 2)
        ctx.lineTo(cx + 2, cy + 9)
        ctx.closePath(); ctx.fill()

        // Centre label lines (decorative silkscreen)
        const lc = g < 0.01 ? 'rgba(255,255,255,0.05)' : `rgba(${GOLD},${g * 0.18})`
        ctx.strokeStyle = lc
        ctx.lineWidth   = 0.7
        ctx.setLineDash([2, 3])
        const midY = cy + chip.ch / 2
        ctx.beginPath()
        ctx.moveTo(cx + 10, midY)
        ctx.lineTo(cx + chip.cw - 10, midY)
        ctx.stroke()
        ctx.setLineDash([])

        // Pins — top & bottom
        const pinGap = chip.cw / (chip.pins + 1)
        const pinH   = 5, pinW = 3
        const pc = g < 0.01
          ? 'rgba(255,255,255,0.16)'
          : `rgba(${GOLD}, ${0.5 + g * 0.5})`

        for (let p = 0; p < chip.pins; p++) {
          const px = cx + pinGap * (p + 1) - pinW / 2
          ctx.fillStyle = pc
          // top pin
          ctx.fillRect(px, cy - pinH, pinW, pinH)
          ctx.beginPath(); ctx.rect(px - 0.5, cy - pinH - 1.5, pinW + 1, 1.5); ctx.fill()
          // bottom pin
          ctx.fillRect(px, cy + chip.ch, pinW, pinH)
          ctx.beginPath(); ctx.rect(px - 0.5, cy + chip.ch + pinH, pinW + 1, 1.5); ctx.fill()
        }

        ctx.restore()
      })

      // ── draw HUD ring (on top of everything) ────────────────────
      drawHUD(mx, my, rotRef.current)

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMove)
      ro.disconnect()
    }
  }, [buildGraph])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
