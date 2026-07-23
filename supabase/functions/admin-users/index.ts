// ============================================================
// Edge Function: admin-users
//
// Lets the two department heads create and hard-delete accounts
// from the app. Anything that touches an auth user's PASSWORD or
// hard-deletes an auth account needs the service-role key, which
// must never live in the browser bundle — so it lives here.
//
//   Henk   (director)        → create/delete  agent | supervisor
//   Raquel (casino_manager)  → create/delete  pit_manager | shift_manager
//
// Actions (POST JSON body):
//   { action: 'create', employee_id, name, password, role }
//   { action: 'delete', user_id }   ← hard delete; blocked if the
//                                      user has any session history
//   { action: 'reset_password', user_id, password }  ← admin-set a
//                                      new password (service role)
//   { action: 'force_logout', user_id }  ← stamp force_logout_at so
//                                      the target's client signs out
//
// Reversible (de)activation does NOT go through here — it uses the
// set_user_active() RPC from add_user_management.sql.
//
// Deploy:  supabase functions deploy admin-users
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
//  injected automatically by the Supabase Edge runtime.)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Roles that belong to the Pit department (everything else is Surveillance).
const PIT_ROLES = ['pit_manager', 'casino_manager', 'shift_manager']
// Only these two roles may create/delete accounts.
const ACCOUNT_MANAGERS = ['director', 'casino_manager']
// Which roles each department head is allowed to assign.
const ASSIGNABLE: Record<string, string[]> = {
  surveillance: ['agent', 'supervisor'],
  pit: ['pit_manager', 'shift_manager'],
}

const deptOf = (role: string) =>
  PIT_ROLES.includes(role) ? 'pit' : 'surveillance'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { error: 'Server is not configured.' })
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Missing authorization.' })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Identify the caller from their JWT.
  const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !caller) return json(401, { error: 'Invalid session.' })

  // 2. Confirm the caller is an active account manager.
  const { data: callerProfile } = await admin
    .from('users').select('role, is_active').eq('id', caller.id).single()

  if (
    !callerProfile ||
    callerProfile.is_active === false ||
    !ACCOUNT_MANAGERS.includes(callerProfile.role)
  ) {
    return json(403, { error: 'You are not authorized to manage user accounts.' })
  }

  const callerDept = deptOf(callerProfile.role)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON body.' })
  }

  // ─── CREATE ────────────────────────────────────────────────
  if (body?.action === 'create') {
    const employee_id = String(body.employee_id ?? '').trim()
    const name = String(body.name ?? '').trim()
    const password = String(body.password ?? '')
    const role = String(body.role ?? '')

    if (!employee_id || !name || !password || !role) {
      return json(400, {
        error: 'Employee ID, name, password and role are all required.',
      })
    }
    if (!/^[A-Za-z0-9._-]+$/.test(employee_id)) {
      return json(400, {
        error: 'Employee ID may only contain letters, numbers, dot, dash and underscore.',
      })
    }
    if (password.length < 8) {
      return json(400, { error: 'Password must be at least 8 characters.' })
    }
    if (!ASSIGNABLE[callerDept].includes(role)) {
      return json(403, {
        error: `You can only assign ${ASSIGNABLE[callerDept].join(' or ')} in your department.`,
      })
    }

    // Clean, friendly duplicate message (the unique index would also catch it).
    const { data: existing } = await admin
      .from('users').select('id').eq('employee_id', employee_id).maybeSingle()
    if (existing) {
      return json(409, { error: `Employee ID "${employee_id}" already exists.` })
    }

    const email = `${employee_id.toLowerCase()}@stellaris.local`
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { employee_id, name, role },
    })
    if (createErr || !created?.user) {
      return json(400, { error: createErr?.message ?? 'Could not create the account.' })
    }

    // The handle_new_user trigger mirrors the auth user into public.users.
    // Backfill defensively in case the trigger is not installed.
    const newId = created.user.id
    const { data: profileRow } = await admin
      .from('users').select('id').eq('id', newId).maybeSingle()
    if (!profileRow) {
      const { error: insErr } = await admin
        .from('users').insert({ id: newId, employee_id, name, role })
      if (insErr) {
        // Roll back the orphaned auth user so the ID can be reused.
        await admin.auth.admin.deleteUser(newId)
        return json(400, { error: insErr.message })
      }
    }

    await admin.from('audit_log').insert({
      user_id: caller.id,
      action: 'USER_CREATED',
      details: { target_user_id: newId, employee_id, role },
    })

    return json(200, { ok: true, id: newId, employee_id, name, role })
  }

  // ─── DELETE (hard) ─────────────────────────────────────────
  if (body?.action === 'delete') {
    const targetId = String(body.user_id ?? '')
    if (!targetId) return json(400, { error: 'user_id is required.' })
    if (targetId === caller.id) {
      return json(400, { error: 'You cannot delete your own account.' })
    }

    const { data: target } = await admin
      .from('users').select('role, employee_id').eq('id', targetId).single()
    if (!target) return json(404, { error: 'User not found.' })

    if (deptOf(target.role) !== callerDept) {
      return json(403, { error: 'You can only delete users in your own department.' })
    }
    if (ACCOUNT_MANAGERS.includes(target.role)) {
      return json(403, { error: 'You cannot delete another administrator account.' })
    }

    // Hard delete is only allowed for accounts with no session history —
    // real training/compliance history must be preserved (deactivate instead).
    const { count: sessionCount } = await admin
      .from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', targetId)
    if ((sessionCount ?? 0) > 0) {
      return json(409, {
        error: 'HAS_HISTORY',
        message: 'This user has session history and cannot be permanently deleted. Deactivate the account instead.',
      })
    }

    // Remove rows that reference the user but lack ON DELETE CASCADE so the
    // auth.users delete can cascade public.users cleanly. (recert_exceptions
    // cascades on its own; session_answers are gone with zero sessions.)
    await admin.from('agent_difficulty').delete().eq('user_id', targetId)
    await admin.from('audit_log').delete().eq('user_id', targetId)

    const { error: delErr } = await admin.auth.admin.deleteUser(targetId)
    if (delErr) return json(400, { error: delErr.message })

    await admin.from('audit_log').insert({
      user_id: caller.id,
      action: 'USER_DELETED',
      details: { employee_id: target.employee_id, role: target.role },
    })

    return json(200, { ok: true, id: targetId, employee_id: target.employee_id })
  }

  // ─── RESET PASSWORD (admin-set) ────────────────────────────
  if (body?.action === 'reset_password') {
    const targetId = String(body.user_id ?? '')
    const password = String(body.password ?? '')
    if (!targetId) return json(400, { error: 'user_id is required.' })
    if (password.length < 8) {
      return json(400, { error: 'Password must be at least 8 characters.' })
    }
    if (targetId === caller.id) {
      return json(400, {
        error: 'Use Change Password to update your own password.',
      })
    }

    const { data: target } = await admin
      .from('users').select('role, employee_id').eq('id', targetId).single()
    if (!target) return json(404, { error: 'User not found.' })

    if (deptOf(target.role) !== callerDept) {
      return json(403, { error: 'You can only manage users in your own department.' })
    }
    if (ACCOUNT_MANAGERS.includes(target.role)) {
      return json(403, { error: 'You cannot reset another administrator\'s password.' })
    }

    const { error: pwErr } = await admin.auth.admin.updateUserById(targetId, { password })
    if (pwErr) return json(400, { error: pwErr.message })

    // Never log the password itself — only who and when.
    await admin.from('audit_log').insert({
      user_id: caller.id,
      action: 'USER_PASSWORD_RESET',
      details: { target_user_id: targetId, employee_id: target.employee_id },
    })

    return json(200, { ok: true, id: targetId, employee_id: target.employee_id })
  }

  // ─── FORCE LOGOUT ──────────────────────────────────────────
  // Stamps force_logout_at; the target's signed-in client polls
  // get_my_force_logout() and signs itself out when it sees a value
  // newer than its access token. This ends the ACTIVE session — for a
  // permanent block, deactivate the account instead.
  if (body?.action === 'force_logout') {
    const targetId = String(body.user_id ?? '')
    if (!targetId) return json(400, { error: 'user_id is required.' })
    if (targetId === caller.id) {
      return json(400, { error: 'You cannot force yourself to log out.' })
    }

    const { data: target } = await admin
      .from('users').select('role, employee_id').eq('id', targetId).single()
    if (!target) return json(404, { error: 'User not found.' })

    if (deptOf(target.role) !== callerDept) {
      return json(403, { error: 'You can only manage users in your own department.' })
    }
    if (ACCOUNT_MANAGERS.includes(target.role)) {
      return json(403, { error: 'You cannot force another administrator to log out.' })
    }

    const { error: updErr } = await admin
      .from('users').update({ force_logout_at: new Date().toISOString() }).eq('id', targetId)
    if (updErr) return json(400, { error: updErr.message })

    // Best-effort server-side session revocation so a stale token can't
    // silently refresh. Not all runtimes expose this; the force_logout_at
    // flag is the guaranteed path, so ignore failures here.
    try {
      // @ts-ignore — signOut(userId, scope) availability varies by version.
      await admin.auth.admin.signOut(targetId, 'global')
    } catch { /* flag-based logout still applies */ }

    await admin.from('audit_log').insert({
      user_id: caller.id,
      action: 'USER_FORCE_LOGOUT',
      details: { target_user_id: targetId, employee_id: target.employee_id },
    })

    return json(200, { ok: true, id: targetId, employee_id: target.employee_id })
  }

  return json(400, { error: `Unknown action "${body?.action}".` })
})
