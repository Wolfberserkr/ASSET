/**
 * TableControls.jsx — shared OrbitControls for the 3D payout tables.
 *
 * Two constraints keep the view sensible for training:
 *   1. maxPolarAngle is kept comfortably above the table plane, so the
 *      camera can never tilt to edge-on or rotate *under* the table.
 *   2. Panning is clamped to a small box around the table so it can't be
 *      dragged off into empty space. The camera is shifted by the same
 *      delta as the clamped target, so bounded panning still feels natural.
 */
import { OrbitControls } from '@react-three/drei'

export default function TableControls({ controlsRef, panLimit = 1.1 }) {
  const handleChange = (e) => {
    const c = controlsRef?.current ?? e?.target
    if (!c || !c.target || !c.object) return

    const t  = c.target
    const cx = Math.max(-panLimit, Math.min(panLimit, t.x))
    const cz = Math.max(-panLimit, Math.min(panLimit, t.z))
    const dx = cx - t.x
    const dz = cz - t.z
    if (dx !== 0 || dz !== 0) {
      t.x = cx
      t.z = cz
      // Move the camera by the same delta so the framing stays consistent.
      c.object.position.x += dx
      c.object.position.z += dz
    }
    // Keep the look-at point on the table surface.
    t.y = 0
  }

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableZoom
      enableRotate
      minPolarAngle={0.18}
      maxPolarAngle={1.15}   /* ~66° — never edge-on or beneath the table */
      minDistance={1.8}
      maxDistance={6}
      target={[0, 0, 0]}
      onChange={handleChange}
    />
  )
}
