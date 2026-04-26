import { useId } from 'react'

/**
 * Animated SVG-turbulence "electric" border. When `active` is false the
 * wrapper is a no-op pass-through so the child renders unchanged.
 */
export default function ElectricBorder({
  active = true,
  color = '#22c55e',
  borderRadius = '1rem',
  thickness = 2,
  speed = 1,
  intensity = 1,
  children,
  className,
  style,
}) {
  const rawId = useId()
  const filterId = `eb-${rawId.replace(/:/g, '')}`

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

  const layerBase = {
    position: 'absolute',
    inset: 0,
    borderRadius,
    border: `${thickness}px solid ${color}`,
    pointerEvents: 'none',
    zIndex: 1,
  }

  return (
    <div className={className} style={wrapperStyle}>
      <svg
        aria-hidden
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
      >
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="turbulence"
              baseFrequency="0.014"
              numOctaves="2"
              seed="3"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.010;0.024;0.010"
                dur={`${7 / speed}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="seed"
                values="1;9;1"
                dur={`${11 / speed}s`}
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={6 * intensity}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius,
          filter: 'blur(20px)',
          opacity: 0.3,
          background: `linear-gradient(-30deg, ${color}, transparent 35%, transparent 65%, ${color})`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ ...layerBase, filter: `url(#${filterId})` }} aria-hidden />
      <div
        style={{ ...layerBase, filter: `url(#${filterId}) blur(2px)`, opacity: 0.7 }}
        aria-hidden
      />
      <div
        style={{ ...layerBase, filter: `url(#${filterId}) blur(8px)`, opacity: 0.5 }}
        aria-hidden
      />

      <div style={{ position: 'relative', zIndex: 2, borderRadius }}>
        {children}
      </div>
    </div>
  )
}
