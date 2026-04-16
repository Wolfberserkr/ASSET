import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useAdaptiveDifficulty
 *
 * Manages the per-agent, per-game difficulty level according to the spec rules:
 *   - Step UP   → 3 consecutive correct at current level
 *   - Step DOWN → 2 consecutive wrong at current level
 *   - Difficulty bounded: 1 (easy) … 3 (hard)
 *
 * Reads from and writes to the `agent_difficulty` table.
 * Exposes `recordAnswer(gameId, isCorrect)` to be called after each question.
 * Exposes `getDifficulty(gameId)` to read the current level for any game.
 *
 * The full difficulty map (all games) is loaded once on mount so that the
 * question randomizer can read all game difficulties simultaneously without
 * extra round-trips.
 *
 * Usage:
 *   const { loading, getDifficulty, recordAnswer } = useAdaptiveDifficulty(userId)
 */

const STEP_UP_THRESHOLD   = 3   // consecutive correct to advance
const STEP_DOWN_THRESHOLD = 2   // consecutive wrong to drop
const MIN_DIFFICULTY      = 1
const MAX_DIFFICULTY      = 3

export function useAdaptiveDifficulty(userId) {
  // Map of gameId → { current_difficulty, consecutive_correct, consecutive_wrong }
  const [diffMap, setDiffMap] = useState({})
  const [loading, setLoading] = useState(true)

  // Keep a ref in sync so `recordAnswer` closures always see the latest state
  const diffMapRef = useRef({})

  const syncRef = (map) => {
    diffMapRef.current = map
    setDiffMap({ ...map })
  }

  // ── Load all rows for this user on mount ──────────────────────
  useEffect(() => {
    if (!userId) return

    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('agent_difficulty')
          .select('game_id, current_difficulty, consecutive_correct, consecutive_wrong')
          .eq('user_id', userId)

        if (error) throw error

        const map = {}
        for (const row of data ?? []) {
          map[row.game_id] = {
            current_difficulty:  row.current_difficulty,
            consecutive_correct: row.consecutive_correct,
            consecutive_wrong:   row.consecutive_wrong,
          }
        }
        syncRef(map)
      } catch (err) {
        console.error('useAdaptiveDifficulty load error:', err)
        // Leave map empty — getDifficulty will return the default of 1
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [userId])

  // ── Read helpers ──────────────────────────────────────────────

  /** Returns the current difficulty (1–3) for a game. Defaults to 1 if unseen. */
  const getDifficulty = useCallback((gameId) => {
    return diffMapRef.current[gameId]?.current_difficulty ?? MIN_DIFFICULTY
  }, [])

  // ── Record a question answer ──────────────────────────────────

  /**
   * Call after every answered question.
   * Updates local state immediately (optimistic) then persists to Supabase.
   *
   * @param {string} gameId   - UUID of the game the question belongs to
   * @param {boolean} isCorrect
   */
  const recordAnswer = useCallback(async (gameId, isCorrect) => {
    if (!userId || !gameId) return

    // Get current state (or defaults for a brand-new game)
    const current = diffMapRef.current[gameId] ?? {
      current_difficulty:  MIN_DIFFICULTY,
      consecutive_correct: 0,
      consecutive_wrong:   0,
    }

    let { current_difficulty, consecutive_correct, consecutive_wrong } = current

    if (isCorrect) {
      consecutive_correct += 1
      consecutive_wrong    = 0   // reset wrong streak on any correct answer

      if (consecutive_correct >= STEP_UP_THRESHOLD) {
        current_difficulty  = Math.min(current_difficulty + 1, MAX_DIFFICULTY)
        consecutive_correct = 0  // reset streak after stepping up
      }
    } else {
      consecutive_wrong   += 1
      consecutive_correct  = 0   // reset correct streak on any wrong answer

      if (consecutive_wrong >= STEP_DOWN_THRESHOLD) {
        current_difficulty = Math.max(current_difficulty - 1, MIN_DIFFICULTY)
        consecutive_wrong  = 0   // reset streak after stepping down
      }
    }

    // Optimistic local update
    const updated = { current_difficulty, consecutive_correct, consecutive_wrong }
    syncRef({ ...diffMapRef.current, [gameId]: updated })

    // Persist via upsert
    try {
      const { error } = await supabase
        .from('agent_difficulty')
        .upsert(
          {
            user_id:             userId,
            game_id:             gameId,
            current_difficulty,
            consecutive_correct,
            consecutive_wrong,
            updated_at:          new Date().toISOString(),
          },
          { onConflict: 'user_id,game_id' }
        )

      if (error) throw error
    } catch (err) {
      console.error('useAdaptiveDifficulty persist error:', err)
      // Local state already updated — will self-correct on next load
    }
  }, [userId])

  return {
    loading,
    getDifficulty,
    recordAnswer,
    /** Full map — useful for the question randomizer to read all games at once */
    difficultyMap: diffMap,
  }
}
