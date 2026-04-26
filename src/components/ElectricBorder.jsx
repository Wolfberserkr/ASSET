import { useId } from 'react'

/**
 * Crackling electric border. SVG turbulence drives a jagged displacement
 * map; multiple stroked layers (sharp + two blurred halos) ride that
 * displacement so the fringe looks like arcing lightning. When `active`
 * is false the wrapper is a pass-through.
 */
export default function ElectricBorder({
  active = true,
  color = '#dd8448',
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

  // brighter inner stroke — derived from base color via mix-blend
  const lightColor = `oklch(from ${color} 0.85 c h)`
  const dimColor = `oklch(from ${color} l c h / 0.5)`

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
            {/* high-frequency, high-octave fractal noise = jagged crackle */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.08"
              numOctaves="3"
              seed="1"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.06;0.12;0.06"
                dur={`${4.8 / speed}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="seed"
                values="1;14;3;9;1"
                dur={`${3.12 / speed}s`}
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={14 * intensity}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* tight inner ambient glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius,
          padding: '2px',
          background: `linear-gradient(135deg, ${dimColor}, transparent 40%, transparent 60%, ${dimColor})`,
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          maskComposite: 'exclude',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* outer halo */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius,
          filter: 'blur(14px)',
          opacity: 0.45,
          background: `linear-gradient(-30deg, ${color}, transparent 35%, transparent 65%, ${color})`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* crackling stroke layers — all share the same turbulence filter */}
      <div
        aria-hidden
        style={{ ...layerBase, borderColor: lightColor, filter: `url(#${filterId})` }}
      />
      <div
        aria-hidden
        style={{
          ...layerBase,
          filter: `url(#${filterId}) blur(1.5px)`,
          opacity: 0.85,
        }}
      />
      <div
        aria-hidden
        style={{
          ...layerBase,
          filter: `url(#${filterId}) blur(6px)`,
          opacity: 0.55,
        }}
      />
      <div
        aria-hidden
        style={{
          ...layerBase,
          filter: `url(#${filterId}) blur(14px)`,
          opacity: 0.35,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2, borderRadius }}>
        {children}
      </div>
    </div>
  )
}
