import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useCooldown
 *
 * Checks the server-side 4-hour global cooldown for the current user
 * and counts down the remaining seconds in real time.
 *
 * - Calls the `check_cooldown` RPC on mount and after `refresh()`.
 * - Ticks down by 1 every second while cooldown is active.
 * - `canDrill` becomes true when remaining seconds hit 0.
 *
 * Usage:
 *   const { loading, canDrill, remainingSeconds, remainingDisplay, refresh } = useCooldown(userId)
 */
export function useCooldown(userId) {
  const [loading,   setLoading]   = useState(true)
  const [remaining, setRemaining] = useState(null)  // null = not yet loaded
  const intervalRef = useRef(null)

  const clearTick = () => {
    clearInterval(intervalRef.current)
    intervalRef.current = null
  }

  const startTick = useCallback((initialSecs) => {
    clearTick()
    if (initialSecs <= 0) return

    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearTick()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const fetch = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('check_cooldown', { p_user_id: userId })
      if (error) throw error

      // RPC returns INTEGER — remaining cooldown seconds (0 = no cooldown).
      const secs = Math.max(0, Number(data) || 0)
      setRemaining(secs)
      startTick(secs)
    } catch (err) {
      console.error('useCooldown fetch error:', err)
      setRemaining(0)   // fail open — don't block agent on network hiccup
    } finally {
      setLoading(false)
    }
  }, [userId, startTick])

  useEffect(() => {
    fetch()
    return clearTick
  }, [fetch])

  // ── Derived ───────────────────────────────────────────────────
  const canDrill = !loading && remaining === 0

  function fmt(secs) {
    if (!secs || secs <= 0) return '00:00'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return {
    loading,
    canDrill,
    remainingSeconds: remaining ?? 0,
    remainingDisplay: fmt(remaining),
    refresh: fetch,
  }
}
