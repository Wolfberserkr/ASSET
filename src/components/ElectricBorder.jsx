/**
 * Breathing-pulse border. Smooth ease-in-out opacity + scale pulse on
 * the border + halo, so the card looks like it's gently breathing.
 * When `active` is false the wrapper is a pass-through.
 */
export default function ElectricBorder({
  active = true,
  color = '#22c55e',
  borderRadius = '1rem',
  thickness = 2,
  speed = 1,
  children,
  className,
  style,
}) {
  const wrapperStyle = {
    position: 'relative',
    borderRadius,
    isolation: 'isolate',
    ...style,
  }

  if (!active) {
    return (
      <div className={className} style={wrapperStyle}>
        {children}
      </div>
    )
  }

  const cycle = 3.2 / speed

  return (
    <div className={className} style={wrapperStyle}>
      {/* Outer halo — wider, slower, softer */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius,
          background: `radial-gradient(closest-side, ${color}, transparent 70%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
          zIndex: 0,
          transformOrigin: 'center',
          animation: `halo-breathe ${cycle}s ease-in-out infinite`,
          willChange: 'opacity, transform',
        }}
      />

      {/* Mid glow — softer ring just outside the stroke */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius,
          border: `${thickness}px solid ${color}`,
          filter: 'blur(6px)',
          pointerEvents: 'none',
          zIndex: 1,
          transformOrigin: 'center',
          animation: `border-breathe ${cycle}s ease-in-out infinite`,
          willChange: 'opacity, transform',
        }}
      />

      {/* Sharp stroke */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius,
          border: `${thickness}px solid ${color}`,
          pointerEvents: 'none',
          zIndex: 3,
          transformOrigin: 'center',
          animation: `border-breathe ${cycle}s ease-in-out infinite`,
          willChange: 'opacity, transform',
        }}
      />

      {/* Children */}
      <div style={{ position: 'relative', zIndex: 2, borderRadius }}>
        {children}
      </div>
    </div>
  )
}
