# Stellaris Surveillance Gaming Drills Platform

## Project Overview
Internal web-based training platform for the Surveillance department at Aruba Marriott Resort & Stellaris Casino. 10 surveillance agents complete mixed gaming drills and quizzes, with a management portal for supervisors and directors to track performance and pull reports.

## Key Personnel
- **Rick** — Sole admin; manages all user accounts, creates and hands off credentials
- **Henk** — Director of Surveillance (management portal user)
- **Angelo** — Supervisor (management portal user; can create and edit questions)
- **Raquel** — Casino Manager (pit management portal user; tracks Pit Managers, can create and edit questions; does not do drills)

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
- **Roles:** `agent`, `supervisor`, `director` (Surveillance) + `pit_manager`, `casino_manager` (Pit)
- **RLS helpers:** `public.get_my_role()` avoids recursion in policies; `get_role_department()` / `get_my_department()` / `get_user_department()` / `get_my_drill_role()` (added in `supabase/add_pit_roles.sql`) enforce the department wall
- **RPC functions:** `check_login_lockout`, `log_login_attempt`, `check_cooldown`, `get_recertification_status`, `get_team_benchmark`, `update_question_stats`, `log_audit_event`, `get_all_agents`, `get_team_leaderboard`, `get_question_stats`

### Departments (Surveillance vs Pit)
Department is **derived from role** — no extra column:
- `agent`, `supervisor`, `director` → **surveillance**
- `pit_manager`, `casino_manager` → **pit**

Rules (enforced server-side via RLS + RPC guards, migration `supabase/add_pit_roles.sql`):
- **Pit Managers** do drills exactly like agents: same session structure, scoring, 4-hour cooldown, 20 sessions/month recert, adaptive difficulty. They use the same agent portal pages (sidebar shows "Pit Operations").
- **Raquel (casino_manager)** uses the same management portal pages as Henk/Angelo but only ever sees Pit staff. She can create/edit questions in the shared pool.
- **Department wall (bidirectional):** surveillance staff never see pit staff data (profiles, sessions, answers, audit entries, recert notes) and vice versa. `get_all_agents`, `get_team_leaderboard`, and `get_team_benchmark` are scoped to the caller's department — benchmarks/leaderboards never mix departments.
- **Shared across departments:** questions, games, resources. `get_my_drill_role()` returns `agent` or `pit_manager` so queries/RPCs list the correct drill-takers; the frontend exposes this as `drillRole` from `AuthContext` (used in Layout notifications, WeakAreas, AuditLog).
- **Question Stats is department-scoped** (migration `supabase/add_department_question_stats.sql`): the `get_question_stats()` RPC recomputes per-question `times_shown` / `times_correct` from `session_answers` restricted to the caller's department, so Raquel sees pit-only accuracy and Henk/Angelo see surveillance-only accuracy over the same shared pool. The global `questions.times_shown` / `times_correct` counters still exist (incremented by `update_question_stats`) but the management Question Stats page no longer reads them.
- Rick creates pit accounts the same way (`{employee_id}@stellaris.local`) with the new role in user metadata.

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

## Games (7 active)
- **Blackjack** → quiz (multiple choice: payouts + game protection scenarios)
- **Roulette** → payout_drill (SVG table + free-type dollar input)
- **Three Card Poker** → payout_drill
- **Let It Ride** → payout_drill
- **Ultimate Texas Hold'em** → payout_drill
- **Craps** → payout_drill, **practice-only for now** (integer-ratio bets are dynamic payout drills; place/buy unit-math, odds ID and game-protection scenarios are multiple choice)
- **Caribbean Stud Poker** → payout_drill (Ante/Bet bonus payouts are payout drills; progressive jackpots and dealer-qualify/surveillance rules are multiple choice)

> A `payout_drill` game may hold both `payout` and `multiple_choice` questions — the UI renders by `question.type`, not by the game's `drill_type`. Craps and CSP use this to mix dynamic chip-stack payouts with fixed-amount rules/procedure questions.

### `practice_only` games
`games.practice_only` (boolean, default FALSE) gates a game to **Practice mode only** — it appears in the Practice game picker and in Mixed practice, but `buildSession` (scored Drills) excludes its questions. **Craps ships with `practice_only = TRUE`** so agents can drill it without it counting toward scored sessions until the whole team is ready. To promote Craps to scored Drills later:
> `UPDATE public.games SET practice_only = FALSE WHERE name = 'Craps';`

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

### Diversity harness (`src/lib/sessionDraw.js`)
Pure selection module (no Supabase imports — unit-testable in plain Node), used by `buildSession` in `questionRandomizer.js`:
- **Cross-session freshness:** questions answered in the agent's last 3 completed sessions are excluded from the draw (soft rule — relaxed automatically if the fresh pool can't fill the session)
- **Per-game cap:** max 4 of the 10 questions per game; shared procedure questions (`game_id NULL`) form their own bucket, also capped at 4 — guarantees at least 3 distinct buckets per session
- **Procedure category cap:** max 2 procedure questions per category per session (e.g. `roulette_procedure` rows read near-identically back to back). Game categories are not capped this way — the bucket cap covers them
- **Near-duplicate dedupe:** no two payout questions with the same game + ratio in one session; no two questions with identical normalized wording
- **Softened weak-area weighting:** game weight = `0.5 + 0.5 × (1 − accuracy)` instead of the old `1 − accuracy`, so a 20%-accuracy game is ~1.5× more likely than an 80% one (was ~4×) — weak areas still surface more, but no longer dominate
- Fallback order when the pool runs short: fresh questions → recently-seen questions → relax dedupe/category rules → relax all caps (a full 10-question session always beats an under-filled one)
- Practice mode is untouched — it cycles endlessly by design

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

### Phase 3 — Visual Payout Drills ✅ COMPLETE
- SVG table layouts for Roulette, Three Card Poker, Let It Ride, UTH, Craps, CSP
- Highlighted bet positions
- Randomized bet amounts from chip_variants

### 3D payout tables (Roulette + Craps)
Roulette and Craps payout drills have a **2D / 3D view toggle** (top-right of the table). The 3D tables use `@react-three/fiber` + `@react-three/drei` (three.js) and are **lazy-loaded** so the three.js bundle only downloads when an agent switches to 3D.
- `src/components/tables/RouletteTable3D.jsx` — 3D American roulette layout (rendered from the same `rouletteScenario` data as the 2D SVG).
- `src/components/tables/CrapsTable3D.jsx` — 3D **half** craps layout (dealer's end): point boxes, Come, Field, Don't Come, Don't Pass Bar, Pass Line, and the center Props/Hardways block. The `activeBet` zone (`line` / `field` / `center`) is highlighted in gold with the wagered chip stack on it.
- `src/components/tables/TableControls.jsx` — shared `OrbitControls` wrapper used by both. `maxPolarAngle` is capped (~66°) so the camera can never rotate **under** the table, and panning is clamped to a small box so the table can't be dragged off-screen.
- Labels use a **bundled** font (`src/assets/label.ttf`, Space Mono) passed to drei `<Text font=…>`, so troika-three-text does **not** fetch its glyph resolver from a CDN at runtime.
- The realistic 2D Craps half-table lives in `PayoutTable.jsx` (`CrapsTable`), rendered with cream felt outlines; `CrapsRenderer` / `RouletteRenderer` host the 2D↔3D toggle.

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
Difficulty tier UI indicators, point leaderboard, email notifications for recertification failures, admin-adjustable scoring multipliers, Game Resources library (videos/articles/bet calcs/rules), editable Knowledge Base (HTML), 2FA for management, shift correlation, time pressure analytics, video clip drills, multi-department support, pre/post training comparison.

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
| Roulette Procedures (shared) | 30 | Multiple choice |
| Craps | ~74 | Payout drill + multiple choice |
| Caribbean Stud Poker | ~78 | Payout drill + multiple choice |
| Craps Procedures (shared) | 30 | Multiple choice |
| CSP Procedures (shared) | 30 | Multiple choice |

Craps and Caribbean Stud Poker are seeded via `supabase/seed_craps_csp.sql` (run once in the Supabase SQL Editor). The file also inserts the two `games` rows idempotently (`WHERE NOT EXISTS`). Both pools mix `payout` questions (clean integer ratios rendered as dynamic chip stacks) with `multiple_choice` questions:
- **Craps** — payout drills for Pass/Come, Don't, Field, Odds/Buy on 4/10, Hardways, and the one-roll props (Any Seven 4:1, Any Craps 7:1, Yo 15:1, Ace-Deuce 15:1, Aces/Boxcars 30:1). Multiple choice covers the fractional place/buy unit-math (9:5, 7:5, 7:6), odds identification (6/8 → 6:5, 5/9 → 3:2, 4/10 → 2:1), the 5% buy vig, and dice-security / past-post / no-roll game-protection scenarios. `category` values (`craps_line`, `craps_field`, `craps_prop`, `craps_hardway`, `craps_odds`, `craps_place`, `craps_protection`) drive which felt band the SVG highlights.
- **Caribbean Stud Poker** — payout drills for the Ante (1:1) and the Bet bonus (Pair 1:1 → Royal Flush 100:1, capped at the $1,000 table max). Multiple choice covers progressive jackpot payoffs (Royal 100%, SF 10%, Quads $500, Full House $100, Flush $50, Straight $25), the Ace/King dealer-qualify rule, tie-breaking, and surveillance triggers (4-of-a-kind+, straight flush cards to Surveillance, $10k win/loss). `category` values `csp_ante` / `csp_bet` pick which spot the SVG highlights; `csp_progressive` / `csp_procedure` are the rules questions.

A second wave of Craps/CSP questions is seeded via `supabase/seed_craps_csp_expansion.sql` (run once; applied to production 2026-07-21). Per game it adds 30 payout questions that **state the odds in the question text** (e.g. "Player bought the 4 (pays 2:1). The shooter rolls a 4. How much does the dealer pay?") and 30 shared procedure questions (`game_id = NULL`, `is_procedure = TRUE`, categories `craps_procedure` / `caribbean_stud_procedure`) drawn from the dealer procedure manuals in `public/resources/`. Each 30-block is balanced 10 easy / 10 medium / 10 hard. Craps payout ratios stay clean against the $5-step bet randomizer (9:5 → `'1.8'`, 7:5 → `'1.4'`, 3:2 → `'1.5'`); the 7:6 place bets on 6/8 remain multiple-choice only.

Roulette procedure questions are seeded via `supabase/seed_roulette_procedures.sql` (`category = 'roulette_procedure'`, `is_procedure = TRUE`, `game_id = NULL`). They are drawn from the casino's Roulette dealer procedures manual, written at a high-school reading level, and balanced 10 easy / 10 medium / 10 hard. Being shared procedure questions, they are eligible in any drill session and appear under the **Procedures** tab in Practice.

Angelo can add/edit questions via the management portal Question Editor. Rick plans to add `table_max_bet` per question in a future update to keep chip randomisation within realistic table limits.

### Roulette payout scenarios (live-generated)
Roulette payout drills do **not** read the DB question's text/answer — `src/lib/rouletteScenario.js` generates a fresh combination-bet scenario at runtime (rendered on the SVG layout by `PayoutTable.jsx`, validated against the computed total payout). The generator covers all six inside bet types: Straight (35:1), Split (17:1), Street (11:1), Corner (8:1), Top Line / five-number 0-00-1-2-3 (6:1), and Line / six-number (5:1). Each scenario uses White ($1) and/or Red ($5) chips — all $1, all $5, or a mix. The same generator powers both scored Drill sessions and Practice mode.

### Blackjack Basic Strategy Trainer
Interactive drill on the house basic strategy chart (sections A–D: hard hitting, hard doubling, soft doubling, pair splits). Two entry points: **Resources → Blackjack → "Strategy Trainer" tab** (next to the Payout Calculator) and a **"Blackjack Strategy" card in the Practice picker** (next to Blackjack).
- `src/lib/blackjackStrategy.js` — pure module (no React/Supabase, unit-testable in plain Node like `sessionDraw.js`): hard/soft/pair strategy tables, weighted scenario generator (never repeats the exact same spot twice in a row), and per-cell rule explanations quoting the house chart.
- `src/components/BlackjackTrainer.jsx` — trainer UI: dealt two-card hand vs dealer up-card on a felt table, Hit/Stand/Double/Split actions (keyboard H/S/D/P, Split disabled unless a pair), mode filter (All/Hard/Soft/Pairs), streak + accuracy stats. Wrong answers show the correct play, the house rule, and the matching strategy-chart row with the dealer column highlighted. A collapsible full chart (hard/soft/pairs) renders from the same tables.
- **Zero database writes** — like Practice mode, no sessions/stats/cooldown; only a `PRACTICE_STARTED` audit event (scope `blackjack_strategy`) when launched from Practice.

### Poker Hand Recognition Trainers (CSP / UTH / LIR / TCP)
Winner-call drills for the four poker games: a full hand is dealt face up and the agent calls the result. Entry points mirror the blackjack trainer: **Resources → (game) → "Hand Trainer" tab** and a gold **"(game) Hands" card in the Practice picker** next to each game.
- `src/lib/pokerHands.js` — pure engine (Node-testable): 5-card, best-5-of-7 (UTH), and 3-card (TCP — straight beats flush, A-2-3 lowest straight, A-K-Q Mini Royal) evaluators; hand naming; house qualify rules (CSP Ace-King, TCP Queen-high, UTH pair "opens"); LIR paytable (pays Pair of Tens+); tie-break explanations; weighted scenario generation. Exact ties are constructed (dealer gets the player's ranks with permuted suits) since they're vanishingly rare in random deals; training mixes surface pushes/no-quals far more than real odds.
- `src/components/PokerWinnerTrainer.jsx` — same aesthetic as the blackjack trainer (shared `PlayingCard.jsx` renderer, felt table, streak/accuracy stats, keyboard shortcuts). Options per game: CSP/TCP `Player · Dealer · Push · No Qualify`, UTH `Player · Dealer · Push`, LIR `Hand Pays · No Pay`. Feedback names both hands and explains the deciding rule/tie-breaker; collapsible per-game rankings + house payout panel.
- **Zero database writes**; `PRACTICE_STARTED` audit event (scope `winner_trainer`) when launched from Practice.

### Trainer / drill sizing & mobile input behavior
- Trainer cards auto-scale to the felt width (`useFeltScale` in `PlayingCard.jsx`, ResizeObserver-based): up to ~2× on desktop, shrink-to-fit on phones. 2D SVG payout tables have doubled `maxHeight` caps; the DrillSession payout column is `max-w-4xl`.
- Payout inputs skip `autoFocus` on touch devices (`hasCoarsePointer` in `src/lib/device.js`) so the on-screen keyboard doesn't cover the table layout — the keyboard only opens when the agent taps the input. Desktop keeps autofocus.

---

## Vite Config
- `base: '/ASSET/'` for GitHub Pages
- Tailwind via @tailwindcss/vite plugin

## Project Structure
```
src/
  components/    — Layout, ProtectedRoute, StatCard
    tables/      — PayoutTable (2D SVG + dispatch), RouletteTable3D, CrapsTable3D, TableControls
  context/       — AuthContext (login, logout, session timeout, lockout)
  hooks/         — useAdaptiveDifficulty, useSessionTimer, useCooldown
  lib/           — supabase.js client, questionRandomizer.js, sessionDraw.js (pure draw/diversity engine)
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
