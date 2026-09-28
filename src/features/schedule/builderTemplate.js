// Markup of the Team Schedule Builder — the reference page's <body>, plus Publish / Unpublish buttons
// and a save-status line. builderApp.js wires it up; builder.css styles it (scoped to .schedule-builder).
export default `
<div class="wrap">
  <header>
    <h1>Team Schedule Builder</h1>
    <p>Builds both half-month schedules for the team, by agent ID: 2 on every shift, extras on 18:00–03:00, days off kept together (never more than 2 in a row), a Sunday off each month, at least 11 hours between shifts, and never more than 5 days in a row (carried across schedules and months). Agents move up one row every schedule, which moves each of them to the next shift. Add vacation, sick leave or cross-training and the builder works around it. Click a date to mark it as a holiday (every shift worked counts as a Double day). Click any cell to pick a shift, OFF, X OFF (extra day off), SICK or VAC. If that leaves a shift short, the page suggests who can cover that day — without touching any other date.</p>
  </header>

  <section class="panel">
    <h2>Month</h2>
    <div class="controls">
      <div class="field"><label for="mon">Month</label><select id="mon"></select></div>
      <div class="field"><label for="yr">Year</label><input id="yr" type="number" min="2024" max="2100"></div>
      <div class="field"><label for="off1">Days off, 1–15</label><input id="off1" type="number" min="0" max="15"></div>
      <div class="field"><label for="off2" id="off2l">Days off, 16–end</label><input id="off2" type="number" min="0" max="16"></div>
      <button class="primary" id="build">Build schedule</button>
      <button id="export">Download Excel</button>
      <button id="publish" hidden>Publish</button>
      <button id="unpublish" class="danger" hidden>Unpublish</button>
      <button id="copyx" title="Copy the schedule with its colours, then paste into Excel">Copy for Excel</button>
      <button id="undo" disabled>Undo</button>
      <button id="reset">Reset</button>
      <div class="progress" hidden id="prog"><i></i></div>
      <button id="cancelBuild" hidden>Cancel build</button>
    </div>
    <p class="note" id="offnote"></p>
    <p class="note sync"><span id="syncNote" aria-live="polite"></span> <button id="syncReload" class="linkbtn" hidden>Reload</button></p>
  </section>

  <section class="panel">
    <div class="row"><h2>Agents</h2><button id="next">Set up next month from this one</button></div>
    <div class="scroll">
      <table class="agents">
        <thead><tr><th>Agent ID</th><th>Row in the 1–15 schedule</th><th>Last shift of previous month</th><th>Days worked in a row at month end</th><th><span class="sr">Team changes</span></th></tr></thead>
        <tbody id="agentRows"></tbody>
      </table>
    </div>
    <div class="hire">
      <div class="field"><label for="hireName">New agent</label><input id="hireName" type="text" placeholder="Agent ID, e.g. B-27"></div>
      <div class="field"><label for="hireFrom">Starts</label><select id="hireFrom"></select></div>
      <button id="hireAdd">Add agent</button>
      <p class="note" style="margin:0;flex:1 1 260px">Changes take effect from the start of a schedule (the 1st or 16th). A new agent fills an open row if someone has left, otherwise joins as an extra on 18:00–03:00 and covers gaps. When someone leaves, their row is removed and the team shrinks.</p>
    </div>
    <div id="pendList"></div>
    <p class="note">Rows are fixed lines — Morning, Night, Afternoon, repeating from row 1. Every schedule each agent moves up one row (row 1 wraps to the last row), which moves everyone forward one shift: Morning → Afternoon → Night → Morning. The last two columns carry rest time and the legal 5-days-in-a-row limit across the month change — fill them in from last month's schedule, or use the button to fill them automatically.</p>
  </section>

  <section class="panel">
    <h2>Vacation, sick leave &amp; cross-training</h2>
    <div class="controls">
      <div class="field"><label for="abA">Agent</label><select id="abA"></select></div>
      <div class="field"><label for="abT">Type</label><select id="abT"><option value="5">Vacation</option><option value="6">Sick leave</option><option value="7">Cross-training (09:00–18:00)</option></select></div>
      <div class="field"><label for="abF">From</label><input id="abF" type="date"></div>
      <div class="field"><label for="abTo">Back to work (blank = not known yet)</label><input id="abTo" type="date"></div>
      <button id="abAdd">Add</button>
    </div>
    <div class="scroll"><table class="abs"><thead><tr><th>Agent</th><th>Type</th><th>From</th><th>Back to work</th><th></th></tr></thead><tbody id="abList"></tbody></table></div>
    <p class="note">Enter the first day away and the day they are back at work (leave it blank if not known yet — they stay out until you fill it in). Adding, removing or changing an entry updates only those days on the schedule; the back-to-work day is always a shift. Vacation, sick leave and cross-training all count as work days, so the 5-days-in-a-row law applies: the agent's normal days off stay in place inside the absence (for example 5 VAC, 2 OFF, 5 VAC). Cross-training stays on the dates entered and counts for rest time, but not toward shift coverage. If there aren't enough agents, the builder cuts days off, spread as evenly as it can, before it leaves a shift short. Dates can run into the next month.</p>
    <div class="controls" style="margin-top:12px">
      <div class="field"><label for="lock">Keep the current schedule unchanged up to and including day</label><input id="lock" type="number" min="0" max="31" value="0"></div>
      <p class="note" style="margin:0;flex:1 1 260px">For a sick call mid-schedule: add the sick days, set this to yesterday's date, then press Build schedule. Only the days after it change. 0 rebuilds the whole month.</p>
    </div>
  </section>

  <section class="panel">
    <div class="row"><h2 id="checksTitle">Rule checks</h2><span class="msg" id="msg"></span></div>
    <div class="checks" id="checks"></div>
    <ul class="issues" id="issues"></ul>

  </section>

  <section class="panel"><h2 id="h1title">1–15</h2><div class="scroll"><table class="grid" id="g1"></table></div></section>
  <section class="panel"><h2 id="h2title">16–end</h2><div class="scroll"><table class="grid" id="g2"></table></div></section>

  <section class="panel">
    <h2>Legend</h2>
    <div class="legend">
      <span><b class="s1">05:00</b>Morning 05:00–14:00</span>
      <span><b class="s2">13:00</b>Afternoon 13:00–22:00</span>
      <span><b class="s3">21:00</b>Night 21:00–05:00</span>
      <span><b class="s4">18:00</b>Late swing 18:00–03:00, only when all three shifts have 2</span>
      <span><b class="s1 ds">05:00 DS</b>Double shift — the dark shade of its own shift colour; straight through two shifts (05:00–22:00, 13:00–05:00, 21:00–14:00), max 4 days in a row and the next day off</span>
      <span><b class="oc">05:00-off</b>Called in on a day off — always yellow; an 8-hour shift (05:00–13:00, 13:00–21:00, 21:00–05:00)</span>
      <span><b class="dblc" style="background:var(--dblc);color:var(--dbl-ink)">21:00-off</b>Double day — amber; called in on a day off and exempt from the 5-day rule, with the days after counting fresh</span>
      <span><b class="s0">OFF</b>Day off</span>
      <span><b class="s5">VAC</b>Vacation</span>
      <span><b class="s6">SICK</b>Sick leave</span>
      <span><b class="s7">TRN</b>Cross-training 09:00–18:00, off the floor</span>
      <span><b class="ssup" style="display:inline-block">19-04</b>Supervisor (B-20): 07:00–16:00 Jan–Jun, 19:00–04:00 Jul–Dec, off every Sunday and Monday. Outlined in teal when covering an agent shift — the last resort</span>
      <span><b class="s8">X OFF</b>Extra day off requested — kept on rebuild</span>
      <span><b style="background:var(--hol);color:var(--hol-ink)">HOL</b>Holiday (click a date to mark it) — every shift worked that day counts as a Double day</span>
    </div>
  </section>
</div>

<aside class="fixes" id="fixes" aria-live="polite"></aside>
<div class="picker" id="picker" role="menu" hidden></div>
`;
