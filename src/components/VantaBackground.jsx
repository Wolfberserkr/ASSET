import { useEffect, useRef } from 'react'

export default function VantaBackground({ className = '' }) {
  const containerRef = useRef(null)
  const vantaRef     = useRef(null)

  useEffect(() => {
    let threeScript, vantaScript

    const initVanta = () => {
      if (!window.VANTA || !window.THREE || !containerRef.current) return
      vantaRef.current = window.VANTA.NET({
        el:             containerRef.current,
        mouseControls:  true,
        touchControls:  true,
        gyroControls:   false,
        minHeight:      200.00,
        minWidth:       200.00,
        scale:          1.00,
        scaleMobile:    1.00,
        color:           0xd4a843,
        backgroundColor: 0x0b0f1a,
        points:         10,
        maxDistance:    20,
        spacing:        15,
        showDots:       true,
      })
    }

    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = src
        s.onload = resolve
        s.onerror = reject
        document.head.appendChild(s)
        return s
      })

    const setup = async () => {
      try {
        // Three.js must load before Vanta
        if (!window.THREE) {
          threeScript = await loadScript(
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js'
          )
        }
        if (!window.VANTA) {
          vantaScript = await loadScript(
            'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.net.min.js'
          )
        }
        initVanta()
      } catch (err) {
        console.error('Vanta failed to load:', err)
      }
    }

    setup()

    return () => {
      if (vantaRef.current) vantaRef.current.destroy()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
    />
  )
}
