# Stellaris Surveillance Gaming Drills Platform

## Project Overview
Internal web-based training platform for the Surveillance department at Aruba Marriott Resort & Stellaris Casino. 10 surveillance agents complete mixed gaming drills and quizzes, with a management portal for supervisors and directors to track performance and pull reports.

## Key Personnel
- **Rick** — Sole admin; manages all user accounts, creates and hands off credentials
- **Henk** — Director of Surveillance (management portal user)
- **Angelo** — Supervisor (management portal user; can create and edit questions)

## Tech Stack
- **Frontend:** React + Vite, Tailwind CSS v4 (@tailwindcss/vite plugin)
- **Backend/Auth:** Supabase (Postgres, RLS, Auth)
- **Routing:** HashRouter (for GitHub Pages compatibility)
- **Hosting:** GitHub Pages (production) — developed locally first, no staging environment
- **Excel Export:** SheetJS (xlsx)
- **Icons:** Lucide React
- **Fonts:** DM Sans (body), Space Mono (monospace)

## Development Workflow
- All development happens locally on Rick's machine
- No staging environment — local → production (GitHub Pages + Supabase) directly
- Supabase project is used as the backend even during local development (remote Supabase, local Vite dev server)
- Local env vars stored in `.env.local` (never committed)

## Supabase Config
- **Project URL:** `https://wcrxiyterasmmfhfdwtz.supabase.co`
- **Auth pattern:** Employee ID login — email is `{employee_id}@stellaris.local`, Rick creates all accounts manually
- **Roles:** `agent`, `supervisor`, `director`
- **RLS helper:** `public.get_my_role()` function avoids recursion in policies
- **RPC functions:** `check_login_lockout`, `log_login_attempt`, `check_cooldown`, `get_recertification_status`, `get_team_benchmark`, `update_question_stats`, `log_audit_event`, `get_all_agents`

## Database Tables

### `users`
- `employee_id`, `name`, `role`, `is_active`, `last_session_at`
- `is_active` is the deactivation mechanism (no hard delete)

### `games`
- `name`, `drill_type` (quiz or payout_drill)

### `questions`
- `game_id` — nullable; NULL indicates a shared procedure question (chip handling, money transactions, etc.) that appears in any session regardless of game
- `type`, `question_text`, `options`, `correct_answer`, `explanation`
- `category` — values include game-specific categories AND `"procedure"` for shared questions
- `is_procedure` — boolean flag; true when the question applies across all games
- `chip_variants`, `difficulty` (1–3: easy / medium / hard), `points`
- `times_shown`, `times_correct`, `is_active`
- `created_at` — added via `seed_questions.sql` migration (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
- `expires_at` — reserved for future use (e.g., rule changes, compliance windows); TBD
- **Payout answer format:** for `type = 'payout'` questions, `correct_answer` stores the **payout ratio** as a decimal string (e.g. `"35"` for 35:1, `"1.5"` for 3:2). The drill UI validates: `expected = totalBet × ratio` with 2-cent tolerance. The agent types the dollar amount.
- **Future:** Rick plans to add `table_max_bet` per question to cap chip randomisation to realistic table limits

### `sessions`
- `user_id`, `started_at`, `completed_at`, `total_time_seconds`
- `score` — computed with time-based multiplier (see Scoring Formula)
- `total_questions` (always 10), `status` (in_progress / completed / abandoned)
- `ip_address`, `user_agent`
- Sessions are cross-game: each session draws 10 questions from the full active pool across all games

### `session_answers`
- `session_id`, `question_id`, `user_answer`, `is_correct`
- `bet_amount_shown` (payout drills), `answered_at`
- `game_id` — denormalized from question for per-game reporting

### `audit_log`
- `user_id`, `action`, `details`, `ip_address`, `user_agent`
- Append-only; no agent access

### `login_attempts`
- `employee_id`, `ip_address`, `success`, `attempted_at`

### `recertification_rules`
- `min_sessions_per_month` — **20** (not 4)
- `cooldown_hours` — 4 (global, not per-game)

---

## Auth & Account Management

### Account Creation (Rick)
- Rick creates all Supabase auth accounts manually using `{employee_id}@stellaris.local`
- Rick sets the initial password and hands it off to the agent directly
- No email invite or forced password reset on first login

### Password Change (Agents)
- Agents have a "Change Password" option in their dashboard
- Handled via Supabase Auth `updateUser()` — agent must be logged in
- No admin approval required

---

## Games (5 active in V1)
- **Blackjack** → quiz (multiple choice: payouts + game protection scenarios)
- **Roulette** → payout_drill (SVG table + free-type dollar input)
- **Three Card Poker** → payout_drill
- **Let It Ride** → payout_drill
- **Ultimate Texas Hold'em** → payout_drill
- Craps and Caribbean Stud → deferred for later

### Chip Denominations (used in payout drill randomization)
White ($1), Red ($5), Green ($25), Black ($100), Purple ($500), Pink ($1,000)

### Blackjack Quiz Scope
Questions must cover:
- Payout calculations (blackjack, side bets, splits, doubles)
- Game protection scenarios (suspicious player behavior, procedure violations, advantage play indicators)

### Payout Drill Scope
- Agent sees a bet layout (chip stack on table position)
- Agent types the correct dollar payout amount
- No bet-type identification required — dollar amount only

---

## Question Pool Requirements
- **Minimum pool per game:** 30–50 active questions before a game is considered ready
- Enforcement: management portal displays a warning when a game's active question count falls below 30
- **Shared procedure questions** (chip handling, money transactions, etc.) are nullable `game_id`, flagged with `is_procedure = true`, and are eligible to appear in any session
- Difficulty is adaptive (see Adaptive Difficulty Engine below)

---

## Session Structure
- **10 questions per session**, drawn from the full active pool across all 5 games
- **10-minute maximum** per session
- Question draw is weighted by the agent's per-game accuracy (weaker areas surface more often)
- Procedure questions (`is_procedure = true`) are eligible in every session draw

---

## Adaptive Difficulty Engine
Each agent has a tracked difficulty level per game (starts at 1 — easy).

Rules:
- **Step up (increase difficulty):** 3 consecutive correct answers at current level
- **Step down (decrease difficulty):** 2 consecutive wrong answers at current level
- Difficulty is bounded at 1 (floor) and 3 (ceiling)
- Stored per agent per game in an `agent_difficulty` table:
  - `user_id`, `game_id`, `current_difficulty`, `consecutive_correct`, `consecutive_wrong`, `updated_at`

---

## Scoring Formula
- **Base score per correct answer:** 10 points
- **Time-based multiplier:** applied to total base score at session completion
  - Completed in ≤ 5 min → ×1.5
  - Completed in 5–7.5 min → ×1.25
  - Completed in 7.5–10 min → ×1.0
- **Maximum possible score per session:** 150 points (10 correct × 10 pts × 1.5)
- Abandoned or incomplete sessions receive a score of 0 and are not written to the completed record

> Note: multiplier thresholds and values are initial defaults — Henk/Rick should be able to adjust these in a future admin settings panel (V2).

---

## Cooldown & Recertification

### Cooldown
- **4-hour global cooldown** after each completed session
- Applies across all games — no per-game bypass
- Enforced server-side via `check_cooldown` RPC

### Recertification
- **20 completed sessions per month** required per agent
- Only sessions with `status = 'completed'` count — abandoned sessions do not
- When an agent fails to reach 20 sessions by month end:
  - Automatic flag is set on the agent's record
  - In-app notification sent to Henk and Angelo
  - Notification mechanism: in-app alert in management dashboard (email notifications deferred to V2)

---

## Management Portal Access
- **Henk (director) and Angelo (supervisor) see identical data** — no role-based visibility split in V1
- **Angelo can create and edit questions** from the management portal
- Rick retains sole control over user account management

---

## Excel Exports
- All export views support filtering by: **date range**, **agent**, and **game** before export
- Format is fully custom — no Marriott/corporate template required
- Export available on: team dashboard, agent detail, completion tracker, weak areas, question stats, audit log

---

## Build Phases

### Phase 1 — Foundation + Security ✅ COMPLETE
- Supabase tables, RLS, RPC functions
- React + Vite + Tailwind scaffold
- Auth flow with Employee ID login
- Agent password change flow
- Failed login lockout (5 attempts / 15 min)
- Session timeout (30 min inactivity)
- Role-based routing
- Agent dashboard with cooldown timer, recertification status (20 sessions), team benchmark
- Management team dashboard with agent rankings, game averages, Excel export (filtered)
- Audit logging

### Phase 2 — Drill Engine + Anti-Gaming ✅ COMPLETE
- Cross-game adaptive question randomizer (weighted by per-game accuracy + difficulty engine)
- Multiple choice UI with shuffled options (Blackjack)
- Free-type payout dollar input UI (Roulette, TCP, LIR, UTH)
- Payout drill chip variant randomization (text-based chip stacks; SVG upgrade in Phase 3)
- Payout validation uses ratio-based logic: `expected = totalBet × ratio` (2-cent tolerance)
- Session timer (10-minute cap)
- Time-based score multiplier
- Session scoring + write to Supabase
- Abandoned session detection + logging
- 4-hour global cooldown enforcement
- Results screen with missed question review (correct answer + explanation)
- Question pool minimum warning in management portal (< 30 questions per game)
- **Question pool seeded** (`supabase/seed_questions.sql`): 31 Roulette, 30 TCP, 30 LIR, 30 UTH, 30 Blackjack, 15 Procedures = **166 questions**
- Tested locally and confirmed working end-to-end

### Phase 2.5 — Practice Mode ✅ COMPLETE
- **Practice tab** added to agent sidebar alongside **Drill tab**
- Agents choose a game to practice: Blackjack, Roulette, TCP, LIR, UTH, Procedures, or Mixed (all games)
- Immediate feedback shown after every answer — correct/wrong banner, correct answer, and explanation
- Payout questions use same chip stack display and ratio-based validation as the scored drill
- Running accuracy counter (correct / answered) shown in the top bar
- Questions shuffle and cycle endlessly — no pool exhaustion
- **Zero database writes** — no session created, no stats updated, no cooldown triggered, adaptive difficulty unaffected
- Session timeout confirmed at 30 min inactivity (was already correct — no change needed)

### Phase 3 — Visual Payout Drills
- SVG table layouts for Roulette, Three Card Poker, Let It Ride, UTH
- Highlighted bet positions
- Randomized bet amounts from chip_variants

### Phase 4 — Management Reports + Compliance
- Agent detail page (score trend, per-game averages, session history with IP/device)
- Completion tracker with 20-session recertification enforcement + automated flagging
- In-app notifications to Henk/Angelo when agent misses monthly target
- Decay alerts (15%+ drop in 2-week rolling average)
- Weak areas report
- Question effectiveness report
- Audit log viewer
- Filtered Excel export on all views + compliance training records export

### Phase 5 — Polish & Deploy
- Agent session history page
- Mobile responsiveness
- Question pool CSV upload guide
- Security walkthrough
- User acceptance testing
- Deploy to GitHub Pages + Supabase production

---

## V2 Ideas (deferred)
Difficulty tier UI indicators, point leaderboard, email notifications for recertification failures, admin-adjustable scoring multipliers, Game Resources library (videos/articles/bet calcs/rules), editable Knowledge Base (HTML), 2FA for management, shift correlation, time pressure analytics, video clip drills, multi-department support, pre/post training comparison, Craps + Caribbean Stud games.

---

## Security Features (V1)
- Audit log (append-only, agents have no access)
- Failed login lockout (5 attempts / 15 min window)
- Session timeout (30 min inactivity)
- Anti-gaming: answer hashing, option shuffling, abandoned session logging
- IP/device logging on sessions
- 4-hour global cooldown between sessions
- Mandatory recertification (20 completed sessions/month)
- No sensitive data in client-side storage
- Employee IDs never in URLs (UUIDs only)

---

## Question Pool — Current State
Seeded via `supabase/seed_questions.sql` (run once in Supabase SQL Editor).

| Game | Questions | Type |
|---|---|---|
| Roulette | 31 | Payout drill |
| Three Card Poker | 30 | Payout drill (Pair Plus) |
| Let It Ride | 30 | Payout drill |
| Ultimate Texas Hold'em | 30 | Payout drill (Trips bet) |
| Blackjack | 30 | Multiple choice |
| Procedures (shared) | 15 | Multiple choice |

Angelo can add/edit questions via the management portal Question Editor. Rick plans to add `table_max_bet` per question in a future update to keep chip randomisation within realistic table limits.

---

## Vite Config
- `base: '/ASSET/'` for GitHub Pages
- Tailwind via @tailwindcss/vite plugin

## Project Structure
```
src/
  components/    — Layout, ProtectedRoute, StatCard
  context/       — AuthContext (login, logout, session timeout, lockout)
  hooks/         — useAdaptiveDifficulty, useSessionTimer, useCooldown
  lib/           — supabase.js client, questionRandomizer.js
  pages/
    Login.jsx
    agent/       — Dashboard, DrillSession, Results, History, ChangePassword, Practice
    management/  — TeamDashboard, AgentDetail, Completion, WeakAreas, QuestionStats, AuditLog, QuestionEditor
```

## Important Patterns
- Auth emails follow pattern: `{employee_id.toLowerCase()}@stellaris.local`
- RLS uses `public.get_my_role()` SECURITY DEFINER function to avoid recursion
- All management queries use this helper to check role
- Theme colors defined in index.css as CSS custom properties via `@theme`
- Production builds go to `dist/` — upload contents (not folder) to GitHub Pages root
- `.nojekyll` file required in repo root for GitHub Pages
- Shared procedure questions have `game_id = NULL` and `is_procedure = TRUE`
- Session draw always pulls from the full active cross-game pool — there is no per-game session
