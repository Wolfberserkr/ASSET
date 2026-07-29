# A.S.S.E.T. User Manual — source notes

Internal working note for the platform administrator. **Not part of the manual** and not for
distribution — the manual (`../ASSET-User-Manual.pdf`) is the document users read.

Everything the manual states was verified against the application source in this repo and the
live Supabase project (`wcrxiyterasmmfhfdwtz`, read-only) on 2026-07-27. The 25 screenshots in
`img/` are captures of the live application using the demonstration data set.

**Property name:** the manual carries no property, resort, or casino brand name anywhere in its
text, and `img/fig-create-user.png` has the hint line under the Employee ID field blanked, because
it displayed the derived login domain. See §C below for the places the *application* still emits
that name.

---

## A. Where each stated rule was verified

| Manual section | Statement | Verified in |
|---|---|---|
| §2 | Login derives the synthetic internal address from the Employee ID; lockout 5 / 15 min; 30-min idle sign-out; forced logout within ~1 min | `context/AuthContext.jsx`, `pages/Login.jsx` |
| §2.2 | Self-service password: ≥ 8 characters, ≥ 1 number, must match | `pages/agent/ChangePassword.jsx` |
| §5.1 | `score = round(correct × 10 × multiplier)`; ×1.5 / ×1.25 / ×1.0 bands | `pages/agent/DrillSession.jsx::computeScore` |
| §5.2–5.3 | 4-hour cooldown, 20 sessions/month | `recertification_rules` (live: 4 / 20), `check_cooldown`, `get_recertification_status` |
| §5.4 | Adaptive difficulty 3-up / 2-down, bounded 1–3, practice excluded | `hooks/useAdaptiveDifficulty.js` |
| §5.5 | Draw: freshness over last 3 sessions, 4-per-game cap, 2-per-procedure-category cap, dedupe, `0.5 + 0.5 × (1 − accuracy)` weighting | `lib/sessionDraw.js`, `lib/questionRandomizer.js` |
| §5.5, §5.7 | Craps `practice_only = TRUE`; pool counts per game | `games` table (live), `questions` table (live) |
| §6.1 | Roster and monthly averages include deactivated accounts | `get_all_agents` (`supabase/add_user_management.sql`) |
| §6.3 | Status rules and `needed ÷ daysLeft > 1.5` | `pages/management/Completion.jsx` |
| §6.4 | Date ranges 30/90/180/all, default 90; completed sessions only | `pages/management/WeakAreas.jsx` |
| §6.5 | Department-scoped shown/correct; Too Easy ≥ 90 %, Too Hard ≤ 40 % after 10 showings; pool minimum 30 | `get_question_stats`, `pages/management/QuestionStats.jsx` |
| §6.6 | Payout answers store the ratio; 2-cent tolerance | `DrillSession.jsx::validatePayoutAnswer`, `QuestionEditor.jsx` |
| §6.7 | Page filters `users.role = drillRole`; 500-row cap | `pages/management/AuditLog.jsx` |
| §6.8 | Missed-target = active drill-takers below 20 last month; decay = 14 vs 14 days, ≥ 15 %, ≥ 3 sessions each window; dismissals in `localStorage`; 5-min cache | `components/Layout.jsx`, `lib/decayUtils.js` |
| §7.1 | Recert-rate denominator is today's active roster; Active = distinct drill-takers with ≥ 1 completed session | `get_department_scorecard` |
| §7.2 | Digest counts every role in the department; failed logins matched to the department roster | `get_audit_digest`, `get_failed_login_summary` |
| §7.3 | Progress = qualifying drills + practice credits (10 questions = 1), drill floor, target default 3 | `supabase/add_remediation.sql`, `supabase/add_practice_tracking.sql` |
| §7.4 | Six actions, department wall, non-self, non-head; delete blocked with session history and removes the target's audit rows; 8-character minimum | `supabase/functions/admin-users/index.ts`, `set_user_active` |
| §12 | RLS + `SECURITY DEFINER` helpers; `login_attempts` is RPC-only; no automatic purge anywhere | `supabase/*.sql` |

## B. Behaviours the manual documents that could instead be fixed in code

Each of these is described accurately in the manual as current behaviour. None blocks anything;
each is a small change if the app should match the obvious expectation instead.

1. **Audit Log page scope** (`src/pages/management/AuditLog.jsx`) — the query filters
   `users.role = drillRole`, so question-edit and user-admin events never appear on the page that
   offers a "Question edits" filter. Either widen the filter to the caller's department (RLS
   already allows it, and `get_audit_digest` does exactly this) or drop that filter category.
   *Documented in §6.7 and §14.2.*
2. **Deactivated accounts in the roster** (`get_all_agents`) — leavers keep appearing on the Team
   Dashboard and Completion Tracker with 0 sessions, inflating "below target" and "Flagged"
   counts, while the notification bell filters `is_active = true` and disagrees.
   *Documented in §6.1 and §14.3.*
3. **Month boundary is UTC** — the database runs UTC, so `date_trunc('month', NOW())` rolls over
   at 20:00 Aruba time on the last day of the month, while browser-side month calculations
   (Completion's "last month" count, the notification bell) use local midnight. The two disagree
   for a four-hour window each month. Passing an explicit `America/Aruba` timezone into both
   sides would remove it. *Documented in §13.2 and §14.1.*
4. **Notification dismissals are device-local** — one manager dismissing an alert does not clear
   it for the other. A small `notification_dismissals` table would make the bell a shared
   worklist. *Documented in §6.8 and §14.4.*
5. **Exported filenames carry the property name** — every Excel export is written as
   `<property>_team_dashboard_<date>.xlsx`, `<property>_scorecard_…`, `<property>_audit_digest_…`,
   `<property>_remediation_…` and so on (`lib/exportXlsx.js` plus the `filename:` values in
   `Scorecard.jsx`, `Remediation.jsx`, `AuditDigest.jsx`, and `TeamDashboard.jsx`). The
   User Management create-user dialog also prints the derived login domain under the Employee ID
   field (`UserManagement.jsx`). Both are user-facing and both circulate outside the app —
   rename the export prefixes to `asset_` and reword that hint if the name may not appear in
   distributed material. The auth domain itself (`AuthContext.jsx`) cannot be changed without
   migrating every existing login.
6. **Pool headroom** — Ultimate Texas Hold'em sits at exactly 30 active questions and Roulette at
   31, the "ready" minimum. Deactivating a couple in either drops the game below the line.
   *Documented in §6.5 and §8.7.*
