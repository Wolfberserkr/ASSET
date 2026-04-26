import { supabase } from './supabase'

// Fire-and-forget audit writer. Returns a real Promise so callers may
// await when ordering matters (e.g. logout before signOut). Errors are
// swallowed so a failed audit never breaks user flow.
//
// NOTE: supabase-js's PostgrestBuilder is a `then`-able but does NOT
// expose `.catch` / `.finally`, so we wrap it in an async IIFE which
// returns a true Promise.
export function logAudit(action, details = null) {
  return (async () => {
    try {
      const { error } = await supabase.rpc('log_audit_event', {
        p_action:  action,
        p_details: details,
      })
      if (error && import.meta.env.DEV) {
        console.warn(`[audit] ${action} failed:`, error.message)
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[audit] ${action} failed:`, err?.message ?? err)
      }
    }
  })()
}
