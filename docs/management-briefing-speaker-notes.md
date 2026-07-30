# A.S.S.E.T. — Management Briefing

**Speaker notes & timing plan** · Presenter: Ulrich J. Hoek
21 presented slides + Questions + 6 appendix slides (28 pages) · 25 minutes presented, 5–10 minutes questions
Source: *A.S.S.E.T. User Manual & Management Guide v1.0, July 2026* (54 pages).
Deck: Canva — "Presentation - Aruba Surveillance Skill Enhancement Training"

Audience: Director of Surveillance, Casino Manager, Supervisors.
Every figure quoted below is taken from the manual, which in turn was taken from the running application.

---

## Timing plan

| Page | Slide | Time | Running |
|---|---|---|---|
| 1 | A.S.S.E.T. (title) | 0:30 | 0:30 |
| 2 | Welcome to A.S.S.E.T. | 1:00 | 1:30 |
| 3 | The Need for A.S.S.E.T. | 1:30 | 3:00 |
| 4 | A.S.S.E.T. Functionality — three pillars | 1:15 | 4:15 |
| 5 | A Pit Manager's Dashboard — the department wall | 1:30 | 5:45 |
| 6 | The Agent Dashboard | 1:15 | 7:00 |
| 7 | A Live Payout Drill | 1:30 | 8:30 |
| 8 | The Results Screen | 1:15 | 9:45 |
| 9 | Practice Development Tools | 1:15 | 11:00 |
| 10 | Scored Session Rules | 1:45 | 12:45 |
| 11 | Question Selection Logic | 1:30 | 14:15 |
| 12 | Team Dashboard | 1:15 | 15:30 |
| 13 | Completion Tracker | 1:45 | 17:15 |
| 14 | Identifying Performance Gaps | 1:15 | 18:30 |
| 15 | Audit Log & Notifications | 1:00 | 19:30 |
| 16 | Department Scorecard | 1:15 | 20:45 |
| 17 | Remediation Assignments | 1:00 | 21:45 |
| 18 | User Management | 1:00 | 22:45 |
| 19 | Security, Privacy, Data Retention | 1:00 | 23:45 |
| 20 | Operating Routine | 0:45 | 24:30 |
| 21 | Current Status — decisions needed | 1:00 | 25:30 |
| 22 | Questions & Support | 5–10 min | — |
| 23–28 | Appendix — not presented | — | — |

Pages 20 and 21 are the compressible pair. If you are running long, state the routine in one sentence
("bell daily, tracker weekly, export monthly") and spend the time on the three decisions instead.

---

## Notes by slide

**1 — Title**
Name, date, and the platform. Say up front that everything shown is the live application, and that the
screenshots use demonstration data — fictional names, seeded history. Your real screens show your team.

**2 — Welcome to A.S.S.E.T.**
One sentence on what it is: the department's web-based drill platform, live at assetdrills.com, with 20
drill-takers on it today — 10 agents and 10 pit managers, plus one Supervisor, one Director, one Casino
Manager.

**3 — The Need for A.S.S.E.T.**
The argument, not the feature list. Skill was assumed and never measured; proving a team was trained
meant memory rather than records; weak areas surfaced after an incident, not before one. Land on the
phrase you want repeated back: *readiness you can see, coach, and export.*

**4 — Three pillars**
Twenty seconds each. Drills are scored and capped at ten minutes; practice is unlimited and unscored;
the reporting layer turns both into evidence.

**5 — Pit Manager's Dashboard, and the department wall**
The screenshot is the Pit side — note "PIT OPERATIONS" in the sidebar. Identical drills, scoring, and
rules to Surveillance. Then the wall: enforced in the database, not hidden in the interface, so a
hand-typed address cannot cross it. And the consequence — never compare a Surveillance figure with a
Pit figure and call it a gap. Different populations.

**6 — The Agent Dashboard**
One sentence: the drill-taker can answer "where do I stand" without asking anyone — sessions this
month against 20, 14-day average, cooldown state, per-game accuracy rings. Note the leaderboard shows
Employee IDs, not names. Deliberate.

**7 — A live payout drill**
The demo slide. A chip stack sits on the real table layout and the agent types the dollar payout;
answers are accepted within two cents so rounding never costs a question. Multiple choice covers rules
and game protection, options shuffled every showing. Then the abandon rule: leave early and it scores
0, does not count toward the 20, and asks for a reason management can read.

**8 — The Results screen**
The point is the explanation, not the score. Every missed question comes back with the layout, the
correct answer, and the written rule. If someone asks where the training actually happens, it is here.

**9 — Practice and trainers**
Anticipate the suspicion. Practice cannot help a score and cannot hurt a record: it never touches
score, cooldown, difficulty, certification, or question statistics. It leaves two traces — a
practice-started audit entry and a per-game question count — and those exist so effort is visible and
can earn remediation credit.

**10 — Scored session rules**
Read the formula once, then go straight to the worked comparison: eight correct in four minutes (120)
beats ten correct in eight (100). Then the four-hour cooldown — global, server-enforced, no device or
reload shortens it — and 20 completed sessions a calendar month. Twenty sessions four hours apart is a
planning problem: realistically one or two per shift. This is where agents get flagged, and it is
avoidable.

**11 — Question selection logic**
Two halves. Adaptive difficulty moves per person per game, and a hard question is still worth 10 points
so scores stay comparable. The draw is not a random ten: freshness excludes the last three sessions, a
4-of-10 cap per game, no near-duplicates, and a weak-area lean of about 1.5× — enough to steer, not
enough to dominate. Close with the pool: 693 active questions, Craps practice-only for now, and
Ultimate Texas Hold'em sitting exactly on the 30-question minimum.

**12 — Team Dashboard**
The two banners are the working surface: below target in amber, score decay in purple. Decay is a
15%-or-more drop, 14 days against the previous 14, with at least three sessions in each window — so a
quiet fortnight cannot fake one. Get ahead of two recurring questions: Avg Score is this calendar month
and empties on the 1st by design, and deactivated accounts stay on the roster because their training
history is retained.

**13 — Completion Tracker**
The compliance slide; give it the extra time. Four statuses, and At Risk is the one that needs a
conversation — more than 1.5 sessions a day now required. On notes: a note explains, it does not
excuse. Status, count, and flag do not change; the note travels with the number into both exports so a
report read months later is not mistaken for unexplained non-compliance. Then Compliance Records — the
file that answers "prove this team was trained" — and the warning that a downloaded workbook has no
department wall and no audit trail.

**14 — Weak Areas and Question Stats**
One discipline to repeat: read accuracy next to volume. 55% over 400 answers is a training problem;
55% over 9 answers is noise. And Question Stats is department-scoped by design — your numbers and the
other head's will differ over the same shared pool, and both are right.

**15 — Audit Log and notifications**
Append-only, no drill-taker access, filterable, exportable, newest 500 rows displayed. Say the cap is a
display limit, not a retention limit. On the bell: dismissals are stored in your own browser, so it is
your worklist, not a shared queue — anything needing joint action goes into Remediation.

**16 — Department Scorecard**
Handle the "which average is right" question before it is asked: the Team Dashboard tile averages each
person's monthly average (everyone counts equally), the Scorecard averages every session (heavy
drillers weigh more). Quote the Scorecard for department performance. MTD always looks weak against a
closed month — judge on accuracy and average score mid-month, not volume. Then the Digest's weekly
two-minute security read: unexplained password resets, unexplained forced logouts, double-digit failed
logins.

**17 — Remediation**
Assign a game or Procedures with a note and a due date; the form suggests the person's weakest game.
Progress counts qualifying drills plus practice credits (10 focused practice questions = 1 credit), and
auto-completion requires at least one real drill — the drill floor, so practice can never certify
itself. Add the coaching point: write the note as if you will not be there.

**18 — User Management**
Six actions, department-walled, all recorded, no administrator ticket. The line to leave in the room:
to remove someone immediately, deactivate first, then force logout — in that order, so the account is
blocked before the session is dropped. Permanent delete is only for accounts that never ran a session;
the application refuses anything else, deliberately.

**19 — Security, privacy, retention**
Run the controls list briskly; they are table stakes. Spend the time on two things. IP and device are
recorded to confirm or clear a specific concern — one person drilling on another's account — not to
monitor staff routinely. And retention: nothing is purged automatically, which is what you want for
training evidence and what you must be deliberate about for privacy. An undocumented keep-everything is
still a position; it should be a chosen one.

**20 — Operating routine**
The screens are only half the system. Daily five minutes, weekly review, month-end close-out. The habit
that matters is acting on one thing a day rather than ten at month end.

**21 — Current status, and what we need from you**
Close on decisions, not features. Three asks: when Craps moves into scored drills, what retention period
the property's records policy requires, and whether Pit wants a Shift Manager account (built, ready,
unused). Then the not-built list, explicitly so nobody plans a process around it — in particular there
are no email alerts; alerts are in-app only.

**22 — Questions & Support**
Open the floor. Appendix slides follow — jump to them by number as needed.

---

## Appendix — jump targets during Q&A

| Page | Screen | Jump to it when asked about |
|---|---|---|
| 23 | Agent Detail | "What do you actually see about one person?" · IP and device logging |
| 24 | Audit Digest | "How do we know who reset that password?" · weekly security read |
| 25 | Question Editor | "Who writes the questions?" · pool maintenance |
| 26 | Practice feedback | "What does an agent see when they get one wrong?" |
| 27 | Resources library | "What reference material do they have?" |
| 28 | Session History | "Can an agent see their own record?" · abandoned sessions |

---

## Likely questions, and the short answers

**"The two dashboards show different averages — which is right?"**
Both. Average of averages on the Team Dashboard, session-weighted on the Scorecard. Quote the Scorecard
for the department, the Team Dashboard for individuals.

**"When exactly does the month roll over?"**
20:00 Aruba time on the last day — the counters are computed on a UTC server. A session finished at
21:00 on 31 July counts toward August. Tell anyone chasing a twentieth session to be done before 8pm.

**"Why is someone who left still on my roster?"**
Deactivated accounts stay on the Team Dashboard and Completion Tracker with 0 sessions because their
training history is retained. They drop off the leaderboard and out of the bell immediately. Add a
recert note explaining the departure.

**"Can agents game it?"**
The obvious routes are closed: options shuffled per display, payout answers computed rather than
matched, cooldown enforced server-side, recent questions excluded, abandons logged with a reason. The
remaining risk is one person drilling on another's account — which is what the IP and device column
exists to check.

**"Can we change the 20 sessions or the 4 hours?"**
Yes, in the database, by the platform administrator. There is no settings screen, and the scoring
multipliers are fixed in the application.

**"Why does my Audit Log show no question edits?"**
That page lists drill-takers only. Management's own actions are recorded against the manager and read
in the Audit Digest.

**"Are there email notifications?"**
No. In-app only, on the bell. If someone must act, tell them — the platform will not.

---

## Deck aesthetic (from the manual)

| Role | Value |
|---|---|
| Slide background | `#031F3C` |
| Heading blue | `#6A8BB0` |
| Body text | `#CBD7E0` |
| Manual page / dark panel | `#0F1A2F` · `#111826` |
| Accent blue | `#2A5BD7` |
| Positive | `#12784A` |
| Caution / gold | `#9A6B06` |
