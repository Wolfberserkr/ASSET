const WINDOW_MS    = 14 * 24 * 60 * 60 * 1000
const MIN_SESSIONS = 3
export const DECAY_THRESHOLD = 0.15   // 15% drop triggers alert

// sessions: [{ user_id, score, completed_at }]
// Returns: { [userId]: { recentAvg, priorAvg, dropPct, isDecaying } }
export function computeDecay(sessions) {
  const now         = Date.now()
  const recentStart = now - WINDOW_MS
  const priorStart  = now - 2 * WINDOW_MS

  const byUser = {}
  for (const s of sessions) {
    const ts = new Date(s.completed_at).getTime()
    if (ts < priorStart) continue
    if (!byUser[s.user_id]) byUser[s.user_id] = { recent: [], prior: [] }
    if (ts >= recentStart) byUser[s.user_id].recent.push(Number(s.score))
    else                   byUser[s.user_id].prior.push(Number(s.score))
  }

  const result = {}
  for (const [uid, { recent, prior }] of Object.entries(byUser)) {
    if (recent.length < MIN_SESSIONS || prior.length < MIN_SESSIONS) continue
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const priorAvg  = prior.reduce((a, b) => a + b, 0) / prior.length
    if (priorAvg === 0) continue
    const drop = (priorAvg - recentAvg) / priorAvg
    result[uid] = {
      recentAvg: Math.round(recentAvg * 10) / 10,
      priorAvg:  Math.round(priorAvg * 10) / 10,
      dropPct:   Math.round(drop * 100),
      isDecaying: drop >= DECAY_THRESHOLD,
    }
  }
  return result
}

// Dismiss key resets weekly so alerts resurface if decay continues
export function decayDismissKey(userId) {
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  return `decay_${week}_${userId}`
}

// Same two-window comparison as computeDecay, but exposes both directions.
// sessions: [{ score, completed_at }] for a single agent (sorted any order)
// Returns: { recentAvg, priorAvg, deltaPct, direction, recentCount, priorCount }
//   direction: 'up' | 'down' | 'flat' | 'insufficient'
//   deltaPct:  signed integer (e.g. +22 or -15); null when insufficient
export function computeTrend(sessions) {
  const now         = Date.now()
  const recentStart = now - WINDOW_MS
  const priorStart  = now - 2 * WINDOW_MS

  const recent = []
  const prior  = []
  for (const s of sessions) {
    const ts = new Date(s.completed_at).getTime()
    if (ts < priorStart) continue
    if (ts >= recentStart) recent.push(Number(s.score))
    else                   prior.push(Number(s.score))
  }

  if (recent.length < MIN_SESSIONS || prior.length < MIN_SESSIONS) {
    return {
      recentAvg:   null,
      priorAvg:    null,
      deltaPct:    null,
      direction:   'insufficient',
      recentCount: recent.length,
      priorCount:  prior.length,
    }
  }

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const priorAvg  = prior.reduce((a, b) => a + b, 0) / prior.length
  if (priorAvg === 0) {
    return {
      recentAvg:   Math.round(recentAvg * 10) / 10,
      priorAvg:    0,
      deltaPct:    null,
      direction:   'insufficient',
      recentCount: recent.length,
      priorCount:  prior.length,
    }
  }

  const delta = (recentAvg - priorAvg) / priorAvg
  let direction = 'flat'
  if (delta >=  DECAY_THRESHOLD) direction = 'up'
  if (delta <= -DECAY_THRESHOLD) direction = 'down'

  return {
    recentAvg:   Math.round(recentAvg * 10) / 10,
    priorAvg:    Math.round(priorAvg * 10) / 10,
    deltaPct:    Math.round(delta * 100),
    direction,
    recentCount: recent.length,
    priorCount:  prior.length,
  }
}
