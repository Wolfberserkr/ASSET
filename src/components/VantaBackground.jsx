/**
 * Lightweight ambient background — pure CSS radial gradients.
 * Replaces the previous Vanta NET (Three.js + WebGL) implementation,
 * which downloaded ~640KB from CDN per page and ran a continuous GPU
 * render loop. This version is zero-JS and paints once.
 */
export default function VantaBackground({ className = '', style }) {
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundColor: '#0b0f1a',
        backgroundImage: `
          radial-gradient(circle at 18% 22%, rgba(212, 168, 67, 0.10) 0%, transparent 42%),
          radial-gradient(circle at 82% 78%, rgba(59, 130, 246, 0.07) 0%, transparent 48%),
          radial-gradient(circle at 50% 50%, rgba(212, 168, 67, 0.04) 0%, transparent 60%)
        `,
        ...style,
      }}
    />
  )
}
