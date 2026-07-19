import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useCooldown
 *
 * Checks the server-side 4-hour global cooldown for the current user.
 *
 * The RPC result is cached at module level (30s TTL) and shared across all
 * hook instances, so Layout + Dashboard mounting together — or navigating
 * between pages — costs one `check_cooldown` call, not one per mount.
 *
 * The hook stores the cooldown END TIMESTAMP and schedules a single re-render
 * when it expires; it does NOT tick every second. For a live countdown
 * display, render <Countdown endAt={cooldown.endAt} /> — that component
 * ticks in isolation so the page around it stays static.
 *
 * `remainingSeconds` / `remainingDisplay` are snapshots taken at render time.
 *
 * Usage:
 *   const { loading, canDrill, endAt, remainingSeconds, remainingDisplay, refresh } = useCooldown(userId)
 *
 * Call invalidateCooldown(userId) after completing a session so the next
 * check hits the server instead of the cache.
 */

const TTL_MS = 30_000
const cache = new Map() // userId -> { endAt, fetchedAt, promise? }

export function invalidateCooldown(userId) {
  if (userId) cache.delete(userId)
  else cache.clear()
}

export function formatCountdown(secs) {
  if (!secs || secs <= 0) return '00:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function fetchEndAt(userId, force) {
  const hit = cache.get(userId)
  if (!force && hit) {
    if (Date.now() - hit.fetchedAt < TTL_MS) return hit.endAt
    if (hit.promise) return hit.promise
  }

  const promise = supabase
    .rpc('check_cooldown', { p_user_id: userId })
    .then(({ data, error }) => {
      if (error) throw error
      // RPC returns INTEGER — remaining cooldown seconds (0 = no cooldown).
      const secs = Math.max(0, Number(data) || 0)
      const endAt = Date.now() + secs * 1000
      cache.set(userId, { endAt, fetchedAt: Date.now() })
      return endAt
    })
  cache.set(userId, { endAt: hit?.endAt ?? 0, fetchedAt: hit?.fetchedAt ?? 0, promise })

  try {
    return await promise
  } catch (err) {
    cache.delete(userId)
    throw err
  }
}

export function useCooldown(userId) {
  const [loading, setLoading] = useState(true)
  const [endAt,   setEndAt]   = useState(0)

  const refresh = useCallback(async (force = true) => {
    if (!userId) return
    try {
      setEndAt(await fetchEndAt(userId, force))
    } catch (err) {
      console.error('useCooldown fetch error:', err)
      setEndAt(0)   // fail open — don't block agent on network hiccup
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { refresh(false) }, [refresh])

  // One re-render when the cooldown crosses zero — no per-second interval.
  const [, setExpired] = useState(0)
  useEffect(() => {
    const ms = endAt - Date.now()
    if (ms <= 0) return
    const t = setTimeout(() => setExpired(x => x + 1), ms + 250)
    return () => clearTimeout(t)
  }, [endAt])

  const remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))

  return {
    loading,
    canDrill: !loading && remainingSeconds === 0,
    endAt,
    remainingSeconds,
    remainingDisplay: formatCountdown(remainingSeconds),
    refresh,
  }
}
