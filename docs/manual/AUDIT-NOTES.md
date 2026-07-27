# A.S.S.E.T. User Manual — audit notes (v1.0 → v2.0)

Source audited: `ASSETUserManual_1.pdf` (v1.0, 29 pages).
Audited against: the application source in this repo and the live Supabase project
(`wcrxiyterasmmfhfdwtz`), read-only, on 2026-07-27.

Output: `docs/manual/index.html` → `docs/ASSET-User-Manual-v2.pdf` (55 pages).
The 25 screenshots were extracted from the v1.0 PDF and reused unchanged
(`docs/manual/img/`).

---

## A. Corrections — statements in v1.0 that were wrong or incomplete

| # | v1.0 said | Reality | Fixed in |
|---|---|---|---|
| A1 | Audit Log covers "logins, completed sessions, question edits, account changes" for the department | `AuditLog.jsx` filters `users.role = drillRole`, so the page lists **agents / pit managers only**. Question edits and all user-management actions are attributed to the manager who performed them (`user_id = caller.id`) and never appear on that page. They *are* in `get_audit_digest`, which is department-scoped across all roles. Practical effect: the "Question edits" filter is permanently empty. | §6.7 + §14.2 |
| A2 | Practice "writes nothing to your record" / "zero database writes" | Practice writes `practice_activity` rows and a `PRACTICE_STARTED` audit event, and focused practice earns remediation credit. It still never touches score, cooldown, adaptive difficulty, recert count or `session_answers`. | §4.4 + §13.1 |
| A3 | No mention of Craps being excluded from scored drills | `games.practice_only = TRUE` for Craps in production; `buildSession` filters those questions out. 74 active Craps questions are practice-only. | §5.5, §5.7, §14.7 |
| A4 | Completion Tracker described only as "who has hit 20 and who hasn't, with automated flagging" | Four statuses with exact rules (`Completion.jsx::getStatus`): On Track ≥ 20; At Risk when `needed / daysLeft > 1.5`; Below Target otherwise; Flagged when `daysLeft === 0`. | §6.3 |
| A5 | Team Dashboard "Avg Score" undefined | `get_all_agents` returns the **current calendar month** average, and the roster includes deactivated accounts (no `is_active` filter). The tile is an average of per-agent averages, not session-weighted. | §6.1, §11, §14.3, §14.6 |
| A6 | Notifications described without thresholds or storage model | Missed Target = active drill-takers below 20 **last** month; Score Decay = `computeDecay` (14 vs 14 days, ≥ 15 % drop, ≥ 3 completed sessions in each window). Dismissals live in `localStorage` (per browser, per manager); decay dismissals expire weekly; the panel caches for 5 min in `sessionStorage`. | §6.8, §14.4 |
| A7 | Scorecard KPIs undefined | `get_department_scorecard` uses **today's active roster** as the recert-rate denominator for every month shown; "Active" = distinct drill-takers with ≥ 1 completed session that month; avg score is session-weighted. | §7.1, §14.5 |
| A8 | User Management actions listed without consequences | Permanent delete also removes the target's `audit_log` rows and `agent_difficulty`; it is blocked for anyone with session history. Deactivation does **not** end a live session — it must be paired with force logout. Admin-set passwords have an 8-character minimum. | §7.4, §14.9, §14.10 |
| A9 | Audit Log "newest 500 events" (correct) but no guidance | Added: the cap applies to the export too; use the Digest for counts. | §6.7, §14.8 |
| A10 | Roles matrix omitted that management accounts cannot drill | Supervisors/heads have no drill or practice routes, never appear on a leaderboard, and are not subject to the 20-session rule. | §10 |

## B. New material added for management

- **§6 / §7** — every figure on every management screen defined (what it counts, over what
  window, which population), with the exact formulas in "How it is calculated" boxes.
- **§8 Playbooks** — daily / weekly / month-end routines, onboarding, offboarding, coaching a
  weak game, keeping the question pool healthy.
- **§9 Exports** — what each of the ten exports contains, and the warning that exported
  workbooks leave the department wall behind.
- **§11 Metric definitions** — one table reconciling every number, including the two different
  legitimate definitions of "average score".
- **§12 Security, privacy & data** — controls in place, what is stored per person, and the fact
  that **there is no automatic retention or purge** (a decision management needs to own).
- **§13.2** — 24 management FAQs written against real behaviour.
- **§14** — 13 known behaviours documented, plus the deferred-to-v2 list.
- **§15** — one-page quick reference card.

## C. Findings worth considering as *code* changes (not manual changes)

These are documented in the manual as current behaviour. None are broken enough to block
anything, but each is a small fix if you want the app to match the obvious expectation.

1. **Audit Log page scope** (`src/pages/management/AuditLog.jsx:~110`) — the query filters
   `users.role = drillRole`. Question-edit and user-admin events are therefore invisible on the
   page that advertises a "Question edits" filter. Options: widen the filter to the caller's
   department (matching `get_audit_digest`), or drop the "Question edits" category from the
   filter list. *Recommendation: widen to department — RLS already permits it.*
2. **Deactivated accounts in the roster** (`get_all_agents`, used by Team Dashboard and
   Completion Tracker) — leavers keep appearing with 0 sessions and inflate the "below target"
   and "Flagged" counts, while the notification bell (which filters `is_active = true`)
   disagrees. Options: filter inactive users out of the Completion Tracker, or exclude them
   from the status tallies while still listing them.
3. **Month boundary is UTC** — the database runs UTC, so `date_trunc('month', NOW())` rolls over
   at **20:00 Aruba time** on the last day of the month. Browser-side queries (Completion's
   "last month" count, the notification bell) use local midnight, so the two disagree for a
   four-hour window each month. Fix would be to pass an explicit `America/Aruba` timezone into
   the month calculations on both sides.
4. **Notification dismissals are device-local** — Henk dismissing an alert does not clear it for
   Angelo. A small `notification_dismissals` table would make the bell a shared worklist.
5. **UTH pool is exactly at the 30-question minimum** and Roulette at 31 — deactivating a couple
   of questions in either drops the game under the "ready" line.

## D. Verified as correct in v1.0 (no change needed)

Scoring formula and multiplier bands · 10 questions / 10 minutes · 4-hour global cooldown ·
20 sessions per calendar month · adaptive difficulty (3 up / 2 down, bounded 1–3) ·
5 failed logins in 15 minutes · 30-minute idle timeout · force-logout latency (~1 minute) ·
`{employee_id}@stellaris.local` login derivation · department wall behaviour ·
question pool minimum of 30 · Too Easy/Too Hard thresholds · the ten export locations ·
the head-only page list · remediation completion model (drills + practice credits, drill floor) ·
`assetdrills.com` as the access URL.
