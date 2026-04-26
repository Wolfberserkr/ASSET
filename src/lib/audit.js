import { supabase } from './supabase'

// Fire-and-forget audit writer. Returns the promise so callers may await
// when ordering matters (e.g. logout before signOut), but errors are
// swallowed so a failed audit never breaks user flow.
export function logAudit(action, details = null) {
  return supabase
    .rpc('log_audit_event', { p_action: action, p_details: details })
    .catch(err => {
      if (import.meta.env.DEV) {
        console.warn(`[audit] ${action} failed:`, err?.message ?? err)
      }
    })
}
