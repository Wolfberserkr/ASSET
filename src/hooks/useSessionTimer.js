import { useEffect, useRef, useState, useCallback } from 'react'

const SESSION_LIMIT_MS = 10 * 60 * 1000  // 10 minutes hard cap

/**
 * useSessionTimer
 *
 * Tracks elapsed time for an active drill session.
 * - Counts up from 0 every second while `running` is true.
 * - Calls `onExpire` when the 10-minute hard cap is reached.
 * - Returns elapsed seconds + a formatted mm:ss string.
 *
 * Usage:
 *   const { elapsedSeconds, timeDisplay, remaining, isExpired, start, stop, reset } = useSessionTimer({ onExpire })
 */
export function useSessionTimer({ onExpire } = {}) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [running,   setRunning]   = useState(false)

  const startTimeRef  = useRef(null)   // wall-clock time when timer started / last resumed
  const accumulatedRef = useRef(0)     // ms accumulated before the last pause
  const rafRef        = useRef(null)   // requestAnimationFrame id
  const expiredRef    = useRef(false)

  // ── rAF loop (more accurate than setInterval) ─────────────────
  const tick = useCallback(() => {
    const elapsed = accumulatedRef.current + (Date.now() - startTimeRef.current)
    setElapsedMs(elapsed)

    if (elapsed >= SESSION_LIMIT_MS && !expiredRef.current) {
      expiredRef.current = true
      setRunning(false)
      setElapsedMs(SESSION_LIMIT_MS)
      onExpire?.()
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [onExpire])

  const start = useCallback(() => {
    if (running || expiredRef.current) return
    startTimeRef.current = Date.now()
    setRunning(true)
  }, [running])

  const stop = useCallback(() => {
    if (!running) return
    accumulatedRef.current += Date.now() - startTimeRef.current
    cancelAnimationFrame(rafRef.current)
    setRunning(false)
  }, [running])

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    accumulatedRef.current = 0
    startTimeRef.current   = null
    expiredRef.current     = false
    setElapsedMs(0)
    setRunning(false)
  }, [])

  // Start/stop the rAF loop when `running` changes
  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now()
      rafRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [running, tick])

  // ── Derived values ────────────────────────────────────────────
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const remainingMs    = Math.max(0, SESSION_LIMIT_MS - elapsedMs)
  const remainingSecs  = Math.ceil(remainingMs / 1000)
  const isExpired      = expiredRef.current || elapsedMs >= SESSION_LIMIT_MS

  function fmt(secs) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return {
    elapsedSeconds,
    remainingSeconds: remainingSecs,
    timeDisplay:      fmt(elapsedSeconds),       // elapsed  "01:23"
    remainingDisplay: fmt(remainingSecs),         // countdown "08:37"
    isExpired,
    running,
    start,
    stop,
    reset,
  }
}
