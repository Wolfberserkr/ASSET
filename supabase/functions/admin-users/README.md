# `admin-users` Edge Function

Server-side account actions for the two department heads (Henk = `director`,
Raquel = `casino_manager`). Handles the two things that need the Supabase
**service-role key** and therefore cannot run in the browser:

- `create` — create an auth user with a password (department-scoped role)
- `delete` — hard-delete an auth account (only when it has no session history)

Reversible deactivate/reactivate does **not** use this function — it uses the
`set_user_active` RPC in `supabase/add_user_management.sql`.

## One-time deploy (Rick)

1. Run the SQL migration first, in the Supabase SQL Editor:
   `supabase/add_user_management.sql` (adds the `shift_manager` role, the
   department-scoped policy/RPC updates, and `set_user_active`).

2. Install the Supabase CLI and link the project (once):
   ```bash
   npm i -g supabase        # or: brew install supabase/tap/supabase
   supabase login
   supabase link --project-ref wcrxiyterasmmfhfdwtz
   ```

3. Deploy the function:
   ```bash
   supabase functions deploy admin-users
   ```

That's it. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
are injected automatically by the Edge runtime — no secrets to set. The
function verifies the caller's JWT and re-checks that they are an active
`director`/`casino_manager` before doing anything, and enforces the
Surveillance/Pit department wall.

## Authorization model

| Caller           | May create/delete        | Sees (department wall) |
|------------------|--------------------------|------------------------|
| `director`       | `agent`, `supervisor`    | Surveillance staff     |
| `casino_manager` | `pit_manager`, `shift_manager` | Pit staff        |

No head can touch another head's account or a user in the other department.
