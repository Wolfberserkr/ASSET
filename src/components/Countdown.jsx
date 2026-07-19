import { useEffect, useReducer } from 'react'
import { formatCountdown } from '../hooks/useCooldown'

/**
 * Live countdown text to `endAt` (ms timestamp). Isolated so the 1-second
 * tick re-renders only this text node, not the page displaying it.
 * Renders `done` once the countdown reaches zero.
 */
export default function Countdown({ endAt, done = 'Ready' }) {
  const [, tick] = useReducer(x => x + 1, 0)

  useEffect(() => {
    if (!endAt || endAt <= Date.now()) return
    const t = setInterval(() => {
      tick()
      if (Date.now() >= endAt) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [endAt])

  const secs = Math.max(0, Math.ceil(((endAt ?? 0) - Date.now()) / 1000))
  return secs <= 0 ? done : formatCountdown(secs)
}
