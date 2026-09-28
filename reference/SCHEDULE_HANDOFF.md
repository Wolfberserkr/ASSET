# Surveillance Schedule → ASSET: handoff for Claude Code

Paste this whole file to Claude Code in the ASSET repo (or say: "Read HANDOFF.md and do it").
Copy the `src/`, `reference/` and `supabase/` folders from this package into the repo root first.

## Goal

Add a **Schedule** section to ASSET for the Surveillance department only.

| Role (public.users.role) | Access |
|---|---|
| `director`, `supervisor` | Full builder: build, edit, cover short shifts, export Excel, **Publish** |
| `agent` | View only: published schedules, whole team, **own row highlighted**, plus "My next shifts" |
| `pit_manager`, `casino_manager`, `shift_manager`, signed out | No access. Hide the menu item and block the route. |

Inactive users (`is_active = false`) get no access (the database already enforces this).

## Hard rules

1. **Do not rewrite or "improve" the scheduling logic.** `src/features/schedule/engine.js` is the tested engine (ES-module copy of `reference/engine.classic.js`). Use it as is.
2. The complete, tested builder UI is `reference/team-schedule-builder.html` (one file: CSS, the engine and all page logic). It is the source of truth for behaviour, labels, colours and rules. Port it; don't redesign it.
3. **IDs only, never names.** Agents are shown by employee ID (`B-24`). The supervisor is `B-20` and always sits in his own row at the bottom, separate from the agents. Don't join to or display `users.name` anywhere in this section.
4. Keep the existing shift colours exactly (from the reference `:root` variables), both light and dark.

## Database (already live — do NOT re-apply)

The migrations in `supabase/migrations/` are already applied to the ASSET project (`stellaris-drills`). Commit the files for history only.

- `surveillance_schedule_workspace`: one row (`id = 1`) holding the builder state (`state jsonb`) with a `version` for optimistic locking. RLS: Director + Supervisor only.
- `surveillance_schedules`: one row per published month (`year`, `month` 1–12, `data jsonb`, `version`, `published_by`, `published_at`). RLS: read for active agent, supervisor and director accounts; insert/update for Director + Supervisor; delete (unpublish) for Director only.
- Triggers bump `version` and stamp who and when. Every publish, republish and unpublish is written to `audit_log` (`schedule_published` / `schedule_republished` / `schedule_unpublished`).
- Helper functions: `is_schedule_editor()`, `is_surveillance_member()`.

`src/features/schedule/scheduleApi.js` wraps all of this. Fix its Supabase client import path to match the repo.

## Recommended approach (lowest risk)

### 1. Builder page (`/schedule/builder`, Director + Supervisor)

Port the reference page into a React page by moving its script into a module with a mount function, instead of rewriting it component by component:

- `src/features/schedule/builderApp.js` exports `mount(rootEl, { storage, download, publish })` and returns an `unmount()`. It contains the reference page's script, scoped to `rootEl` (replace `document.getElementById` / `$()` lookups with `rootEl.querySelector`, and remove global listeners on unmount).
- `src/features/schedule/builder.css`: the reference CSS, scoped under a `.schedule-builder` wrapper class so it can't leak into ASSET.
- `SchedulePage.jsx` renders the markup (the reference `<body>` content as JSX or `dangerouslySetInnerHTML` of a static template) and calls `mount` in `useEffect`.

Replace three things in the ported script:

| Reference | ASSET |
|---|---|
| `localStorage` key `rota-state-v6` (`save()` and the load at start-up) | `loadWorkspace()` on mount. Debounced `saveWorkspace(S, version)` about 1.5 s after each change. On `CONFLICT`, show "Someone else changed the schedule — reload to see their version" and stop saving until they reload. Keep localStorage only as an offline draft cache. |
| `window.claude.use('downloads')` in `exportXlsx()` | Normal browser download: `XLSX.write` → Blob → object URL → `<a download>`. Use the npm package `xlsx-js-style` (same API as the CDN build the reference loads). |
| Blob worker in `runBuild()` | Vite worker: `new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' })`. The worker imports `engine.js` and runs `buildMonth({...opts, async: true, onProgress})`, posting `{p}` / `{done}` / `{err}` exactly like the reference. Keep the in-page fallback and the Cancel button. |

Add a **Publish** button next to "Download Excel". It calls `publishSchedule(year, month + 1, toPublished(S))`, then shows "Published — agents can see {Month Year} now." If the month is already published, the label changes to **Republish** and you confirm first.

`toPublished(S)` builds the published shape below from `S.result` and `S.holidays`, and nothing else. It must not include absences' reasons beyond the cell codes, pending hires, history or builder settings.

### 2. Agent view (`/schedule`, all surveillance roles)

A native React page (read-only, no engine needed):

- Month picker from `listPublished()`, defaulting to the current month if published, otherwise the latest one.
- Two tables (1–15 and 16–end), with rows in the published row order, supervisor `B-20` at the bottom after a gap, and the same cell labels and colours as the builder (call-in yellow, DS dark shade, Double day amber, X OFF light purple, holiday column gold).
- The signed-in user's row is highlighted. Match `users.employee_id` (e.g. `B-24`) to `data.ids`.
- "My next shifts": the next 7 working days for that user, with start and end times (normal 9 h; call-in 8 h; double shift per the reference `DS_FULL`/`OC_FULL` text).
- Phone first: tables scroll sideways with the ID column sticky. At 640 px or narrower, "My next shifts" comes first.
- Director and Supervisor also see this view, with a link to the builder.

### 3. Navigation and guards

- Show "Schedule" in the ASSET menu for `agent`, `supervisor`, `director` only.
- Guard `/schedule/builder` for `director`/`supervisor`. Everyone else is redirected to `/schedule`. The database already refuses writes; the guard is only for UX.

## Published data shape (`surveillance_schedules.data`)

```json
{
  "schemaVersion": 1,
  "year": 2026,
  "month": 9,
  "days": 31,
  "ids": ["B-24", "B-18", "..."],
  "order": [[0,1,2,3,4,5,6,7,8], [8,0,1,2,3,4,5,6,7]],
  "home": [[1,3,2,1,3,2,1,3,2], [2,1,3,2,1,3,2,1,3]],
  "grid": [[1,1,1,0,0,"..."], "..."],
  "oc": ["3:12"], "ds": ["5:20"], "dbl": ["3:12"],
  "holidays": ["2026-10-25"],
  "sup": { "id": "B-20", "row": [10,10,0,0,"..."], "oc": [14] }
}
```

- `month` is 0–11 inside `data` (as in the builder); the table column `month` is 1–12.
- `order[p]` is the display order of grid rows for half `p` (from `orderOf(r.rows[p])`). `home[p]` is each agent's shift for that half (1 Morning, 2 Afternoon, 3 Night, 4 Extra/18:00).
- Cell codes: 0 OFF, 1 05:00, 2 13:00, 3 21:00, 4 18:00, 5 VAC, 6 SICK, 7 TRN, 8 X OFF, 9 not on team (—). Supervisor codes: 10 own shift, 11 previous half-year hours (bridging), 1–4 covering.
- `oc` = called in on a day off (label "05:00-off", 8-hour shift). `ds` = double shift ("05:00 DS"). `dbl` = Double day (pay only). A holiday makes every worked shift that day a Double day.

## Acceptance checks

- [ ] Director and Supervisor can open the builder. Agent, pit roles and signed-out users cannot (redirected), and a direct API write as an agent fails.
- [ ] Two editors: the second save after the first shows the conflict message, and no silent overwrite happens.
- [ ] Build month runs without freezing the page, and Cancel restores the previous state.
- [ ] All reference behaviours still work: rule checks, cover suggestions (steps 1–5), cell menu (shifts, OFF, X OFF, SICK, VAC, DS, DBL), holidays, absences with back-to-work date, early entry for next month, team changes, undo, two-step reset, Excel export (both halves on one sheet, holidays marked DBL).
- [ ] Publish → an agent sees the month with their own row highlighted and a correct "My next shifts". Republish updates it. Unpublish (Director) hides it.
- [ ] No names appear anywhere in the section. IDs only.
- [ ] Phone (390 px): no sideways page scroll, the cell menu and cover options open as bottom sheets, and the agent view is readable.
- [ ] `npm run build` passes and the GitHub Pages deploy works (mind the Vite `base` path for the worker URL).
