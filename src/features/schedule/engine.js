// ES module wrapper around the Team Schedule Builder engine (same code as the standalone builder).
// Surveillance schedule engine — simulated annealing over a month grid.
// Codes: 0=OFF, 1=Morning 05-14, 2=Afternoon 13-22, 3=Night 21-05, 4=Late 18-03,
//        5=Vacation, 6=Sick, 7=Cross-training 09-18. All three count as work days for the
//        5-in-a-row law; days off (0) are still placed inside an absence period as normal.
//        8=Requested extra day off (rest day, pinned, not counted against the days-off target)
//        9=Not employed (before start / after leaving) — ignored by every rule
const SchedEngine = (function () {
  const SH = { 1: [5, 14], 2: [13, 22], 3: [21, 29], 4: [18, 27], 7: [9, 18] };
  const MIN_REST = 11;
  const WORK = v => v >= 1 && v <= 7;
  const RESTDAY = v => v === 0 || v === 8;
  function restOK(a, b) { // shift a on day d, shift b on day d+1
    if (!SH[a] || !SH[b]) return true;
    return 24 + SH[b][0] - SH[a][1] >= MIN_REST;
  }
  const rot = h => (h % 3) + 1; // Morning -> Afternoon -> Night -> Morning
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  // A shift worked on a day off is an 8-hour call-in: 05:00-13:00, 13:00-21:00, 21:00-05:00.
  const OC_END = { 1: 13, 2: 21, 3: 29, 4: 27 };
  // A double shift runs two shifts back to back: 05:00-22:00, 13:00-05:00, 21:00-14:00 (next day).
  const DS_END = { 1: 22, 2: 29, 3: 38 };
  function buildMonth(opts) {
    const { year, month } = opts; // month 0-based
    const N = opts.agents || 9;
    const D = daysInMonth(year, month);
    const p1Len = 15, p2Len = D - 15;
    const offTarget = [opts.offP1 ?? Math.round(p1Len * 2 / 7), opts.offP2 ?? Math.round(p2Len * 2 / 7)];
    const period = d => (d < 15 ? 0 : 1);
    const prevHome = opts.prevHome || null;
    const prevLast = opts.prevLast || new Array(N).fill(0);
    const prevStreak = opts.prevStreak || new Array(N).fill(0);
    const maxRun = opts.maxRun ?? 5;
    const extra = new Set(opts.extras || []);
    // carry-in from last month's final day: when each agent's last shift ended (hours from the start of that day),
    // who must be off on the 1st (after a double shift), and cover already provided on the 1st (a night double shift runs to 14:00)
    const prevEnd = opts.prevEnd || null;
    const prevMustOff = opts.prevMustOff || [];
    const preCover = opts.preCover || {};
    const supCover = opts.supCover || []; // supervisor covering an agent shift, per day (1..3 or 0)
    // look-ahead to the 1st of next month: who is away (5 VAC, 6 SICK, 7 TRN 09:00) and who is due back on a shift
    const nextAbs = opts.nextAbs || [];
    const nextMust = opts.nextMust || [];
    const oc = new Set(opts.oc || []); // 'i:d' cells worked as a call-in on a day off (8 h)
    const ds = new Set(opts.ds || []); // 'i:d' cells worked as a double shift (covers the next shift too)
    const maxDS = opts.maxDS ?? 4;     // a double shift only up to 4 days in a row, and the next day must be off
    const maxOff = opts.maxOff ?? 2; // max scheduled days off (OFF) in a row
    const prevOff = opts.prevOff || prevLast.map(v => v === 0 ? 1 : 0);
    const dbl = new Set(opts.dbl || []); // 'i:d' cells worked as a Double day (called in on a day off)
    const fixed = opts.fixed || [];   // fixed[i][d] = locked code (e.g. days already worked) or null
    const absence = opts.absence || []; // absence[i][d] = 5/6/7 or null: cell may only be that code or OFF
    const isF = (i, d) => fixed[i] != null && fixed[i][d] != null;
    const must = new Set(opts.mustWork || []); // 'i:d' return-to-work days: must be on a shift
    const absOf = (i, d) => (absence[i] != null && absence[i][d] != null) ? absence[i][d] : 0;
    const okVal = (i, d, v) => { if (isF(i, d)) return v === fixed[i][d]; const ab = absOf(i, d);
      if (ab === 7) return v === 7;              // training is on fixed dates
      if (ab) return v === 0 || v === ab;       // vacation / sick: normal days off stay in place
      if (must.has(i + ':' + d)) return v >= 1 && v <= 4;
      return v <= 4; };
    const home = [[], []];
    for (let i = 0; i < N; i++) {
      const base = opts.startHome ? opts.startHome[i] : prevHome ? rot(prevHome[i]) : (Math.floor(i / 3) % 3) + 1;
      home[0][i] = base; home[1][i] = base === 4 ? 4 : rot(base); // 4 = extra agent (18:00 / cover)
    }
    const prevH = i => prevHome ? prevHome[i] : 0;
    const sundays = []; for (let d = 0; d < D; d++) if (new Date(year, month, d + 1).getDay() === 0) sundays.push(d);
    // per-agent days-off target: full target (absences are separate) but never more than the free days
    const tgt = [];
    for (let i = 0; i < N; i++) {
      tgt.push([0, 1].map(p => {
        const s = p ? 15 : 0, e = p ? D : 15; let free = 0;
        for (let d = s; d < e; d++) if (!isF(i, d) || fixed[i][d] === 0) free++; // absence days can hold days off too
        return Math.min(offTarget[p], free);
      }));
    }
    // days off that fall inside a vacation/sick stretch should follow the normal rhythm (not be piled up there)
    const absExp = [];
    for (let i = 0; i < N; i++) absExp.push([0, 1].map(p => {
      const s0 = p ? 15 : 0, e0 = p ? D : 15; let n = 0;
      for (let d = s0; d < e0; d++) { const ab = absOf(i, d); if ((ab === 5 || ab === 6) && !isF(i, d)) n++; }
      return n ? Math.round(tgt[i][p] * n / (e0 - s0)) : -1;
    }));
    const w = Object.assign({ endMix: 1500, offRun: 5000, absOff: 2000, cover: 2500, offOver: 3000, offCut: 300, offCut2: 100, rest: 5000, sunday: 3000, streak: 5000,
      single: 150, offHome: 250, lateRot: 20, eSpread: 8, eFair: 6 }, opts.weights || {});
    const homeOf = (i, d) => home[period(d)][i];

    function cost(g, detail) {
      let c = 0; const v = detail ? [] : null; const cuts = detail ? [] : null;
      const cov = Array.from({ length: D }, () => [0, 0, 0, 0, 0]);
      for (let i = 0; i < N; i++) for (let d = 0; d < D; d++) {
        const x = g[i][d]; if (x < 1 || x > 4) continue;
        cov[d][x]++;
        if (ds.has(i + ':' + d) && x <= 3) { if (x < 3) cov[d][x + 1]++; else if (d + 1 < D) cov[d + 1][1]++; }
      }
      if (preCover[1]) cov[0][1] += preCover[1];
      for (let d = 0; d < D; d++) { const sc = supCover[d]; if (sc >= 1 && sc <= 3) cov[d][sc]++; }
      for (let d = 0; d < D; d++) {
        const cnt = cov[d];
        let short = false;
        for (let s = 1; s <= 3; s++) if (cnt[s] !== 2) {
          c += w.cover * Math.abs(cnt[s] - 2); if (cnt[s] < 2) short = true;
          v && v.push(`Day ${d + 1}: shift ${s} has ${cnt[s]}`);
        }
        if (cnt[4] > 0 && short) { c += w.cover * cnt[4]; v && v.push(`Day ${d + 1}: 18-03 used while a main shift is short`); }
        if (cnt[4] > 1) c += w.eSpread * (cnt[4] - 1) * (cnt[4] - 1);
      }
      const eCnt = [];
      for (let i = 0; i < N; i++) {
        const row = g[i];
        let o = [0, 0], e = 0;
        for (let d = 0; d < D; d++) { if (row[d] === 0) o[period(d)]++; if (row[d] === 4) e++; }
        eCnt.push(e);
        for (let p = 0; p < 2; p++) {
          const t = tgt[i][p];
          if (o[p] > t) { c += w.offOver * (o[p] - t); v && v.push(`Agent ${i + 1}: ${o[p]} days off in P${p + 1} (target ${t})`); }
          else if (o[p] < t) { const k = t - o[p]; c += w.offCut * k + w.offCut2 * k * k; cuts && cuts.push({ agent: i, period: p, cut: k }); }
        }
        for (let p = 0; p < 2; p++) if (absExp[i][p] >= 0) {
          const s0 = p ? 15 : 0, e0 = p ? D : 15; let n = 0;
          for (let d = s0; d < e0; d++) { const ab = absOf(i, d); if ((ab === 5 || ab === 6) && row[d] === 0) n++; }
          c += w.absOff * Math.abs(n - absExp[i][p]);
        }
        const endOf = d => { const x = row[d]; if (!SH[x]) return null;
          if (ds.has(i + ':' + d) && DS_END[x]) return DS_END[x];
          return oc.has(i + ':' + d) ? (OC_END[x] ?? SH[x][1]) : SH[x][1]; };
        // a double shift is only for someone on 4 days or fewer in a row, and the day after must be off
        for (let d = 0; d < D; d++) if (ds.has(i + ':' + d)) {
          let k = 0; for (let x = d; x >= 0 && WORK(row[x]) && !dbl.has(i + ':' + x) && !oc.has(i + ':' + x); x--) k++;
          if (k > maxDS) { c += w.streak; v && v.push(`Agent ${i + 1}: double shift on day ${d + 1} after ${k} days in a row (max ${maxDS})`); }
          if (d + 1 < D && !RESTDAY(row[d + 1]) && row[d + 1] !== 9) { c += w.streak; v && v.push(`Agent ${i + 1}: no day off after the double shift on day ${d + 1}`); }
        }
        const restPair = d => { const e = endOf(d), n = row[d + 1]; if (e == null || !SH[n]) return true; return 24 + SH[n][0] - e >= MIN_REST; };
        { const n = row[0];
          const bad = prevEnd && prevEnd[i] != null ? (SH[n] && 24 + SH[n][0] - prevEnd[i] < MIN_REST) : !restOK(prevLast[i], n);
          if (bad) { c += w.rest; v && v.push(`Agent ${i + 1}: short rest into day 1`); }
          if (prevMustOff[i] && WORK(n)) { c += w.rest; v && v.push(`Agent ${i + 1}: must be off on day 1 after a double shift`); } }
        for (let d = 0; d + 1 < D; d++) if (!restPair(d)) { c += w.rest; v && v.push(`Agent ${i + 1}: short rest day ${d + 1}->${d + 2}`); }
        if (!row.includes(9) && !sundays.some(d => RESTDAY(row[d]))) { c += w.sunday; v && v.push(`Agent ${i + 1}: no Sunday off`); }
        let run = prevStreak[i];
        for (let d = 0; d < D; d++) {
          if (dbl.has(i + ':' + d) || oc.has(i + ':' + d)) { run = 0; continue; } // came in on a day off: exempt, and the days after it start a fresh count
          if (WORK(row[d])) { run++; if (run > maxRun) { c += w.streak; v && v.push(`Agent ${i + 1}: ${run} days in a row at day ${d + 1}`); } }
          else run = 0;
        }
        let orun = prevOff[i] || 0; // max 2 scheduled days off in a row
        for (let d = 0; d < D; d++) {
          if (row[d] === 0) { orun++; if (orun > maxOff) { c += w.offRun; v && v.push(`Agent ${i + 1}: ${orun} days off in a row at day ${d + 1}`); } }
          else orun = 0;
        }
        for (let d = 0; d < D; d++) if (row[d] === 0 && !isF(i, d)) {
          const l = d > 0 ? RESTDAY(row[d - 1]) : RESTDAY(prevLast[i]) && prevStreak[i] === 0;
          const r = d + 1 < D ? RESTDAY(row[d + 1]) : false;
          if (!l && !r) c += d === D - 1 ? w.single / 2 : w.single;
        }
        for (let d = 0; d < D; d++) {
          const s = row[d]; if (s < 1 || s > 3 || isF(i, d) || extra.has(i)) continue;
          if (s !== homeOf(i, d)) {
            const pd = d < 15 ? d : d - 15;
            const prevHomeP = d < 15 ? prevH(i) : home[0][i];
            c += (pd < 2 && s === prevHomeP) ? w.lateRot : w.offHome;
          }
        }
      }
      // leave the next month a workable start: the 1st needs 2 agents free for each shift.
      // Morning needs someone who finished OFF or on mornings, afternoon also allows an afternoon finish,
      // nights allow anyone. A ⊆ B ⊆ C, so |A|>=2, |B|>=4, |C|>=6.
      let A = 0, B = 0, C = 0;
      for (let i = 0; i < N; i++) {
        const last = g[i][D - 1];
        if (last === 9) continue;
        let k = 0; for (let d = D - 1; d >= 0 && WORK(g[i][d]) && !dbl.has(i + ':' + d) && !oc.has(i + ':' + d); d--) k++;
        if (nextMust[i] && k >= maxRun) {       // due back on the 1st but would pass 5 days in a row
          c += w.streak; v && v.push(`Agent ${i + 1}: back to work on the 1st of next month after ${k} days in a row`); }
        const endLast = !SH[last] ? null : ds.has(i + ':' + (D - 1)) && DS_END[last] ? DS_END[last] : oc.has(i + ':' + (D - 1)) ? (OC_END[last] ?? SH[last][1]) : SH[last][1];
        if (nextAbs[i] === 7 && endLast != null && endLast > 22) { // cross-training starts 09:00 on the 1st: needs 11 h rest
          c += w.rest; v && v.push(`Agent ${i + 1}: under 11 h rest before training on the 1st of next month`); }
        if (nextAbs[i]) continue;               // away on the 1st: can't open next month
        if (k >= maxRun) continue;              // must be off on the 1st
        if (last === 0 || last === 1) { A++; B++; C++; }
        else if (last === 2) { B++; C++; }
        else C++;
      }
      c += w.endMix * (Math.max(0, 2 - A) + Math.max(0, 4 - B) + Math.max(0, 6 - C));
      const core = eCnt.filter((_, i) => !extra.has(i)); const mean = core.reduce((a, b) => a + b, 0) / Math.max(1, core.length);
      eCnt.forEach((e, i) => { if (!extra.has(i)) c += w.eFair * (e - mean) * (e - mean); });
      return detail ? { cost: c, violations: v, cuts } : c;
    }

    function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
    const R = rng(opts.seed ?? Date.now());
    const ri = n => Math.floor(R() * n);

    // The 1st of the month is the tightest day: who worked what last month decides who may open.
    // Pin a legal 2/2/2 arrangement for day 0 so the annealer starts from a coverable day.
    (function pinFirstDay() {
      if (opts.pinFirstDay === false) return;
      const allow = [], locked = [];
      const restIn = (i, s2) => prevEnd && prevEnd[i] != null ? 24 + SH[s2][0] - prevEnd[i] >= MIN_REST : restOK(prevLast[i], s2);
      for (let i = 0; i < N; i++) {
        const a = [];
        if (isF(i, 0)) { const fv = fixed[i][0]; locked[i] = true; if (fv >= 1 && fv <= 3) a.push(fv); allow.push(a); continue; }
        if (absOf(i, 0) || prevMustOff[i]) { locked[i] = true; allow.push(a); continue; } // away or must rest: not available
        if (prevStreak[i] < maxRun) for (let s2 = 1; s2 <= 3; s2++) if (restIn(i, s2)) a.push(s2);
        allow.push(a);
      }
      const mustWorkDay = i => (prevOff[i] || 0) >= maxOff; // two days off already — cannot be off again
      const need = [0, 2 - (preCover[1] || 0) - (supCover[0] === 1 ? 1 : 0), 2 - (supCover[0] === 2 ? 1 : 0), 2 - (supCover[0] === 3 ? 1 : 0)];
      const pick = new Array(N).fill(0);
      const order = [...Array(N).keys()].sort((x, y) => allow[x].length - allow[y].length);
      const solve = k => {
        if (k === order.length) return need[1] <= 0 && need[2] <= 0 && need[3] <= 0;
        const i = order[k];
        if (locked[i]) {                               // fixed or away: take what is set, don't choose
          const s2 = allow[i][0];
          if (s2) { need[s2]--; const ok = solve(k + 1); if (!ok) need[s2]++; return ok; }
          return solve(k + 1);
        }
        for (const s2 of allow[i]) if (need[s2] > 0) { need[s2]--; pick[i] = s2; if (solve(k + 1)) return true; need[s2]++; pick[i] = 0; }
        if (!mustWorkDay(i)) { pick[i] = 0; if (solve(k + 1)) return true; }
        return false;
      };
      if (!solve(0)) return;                       // no legal opening day — let the annealer do its best
      for (let i = 0; i < N; i++) { if (locked[i]) continue; if (!fixed[i]) fixed[i] = new Array(D).fill(null); fixed[i][0] = pick[i]; }
    })();

    function initial() {
      const g = [];
      for (let i = 0; i < N; i++) {
        const row = [];
        for (let d = 0; d < D; d++) row.push(isF(i, d) ? fixed[i][d] : absOf(i, d) || homeOf(i, d));
        for (let p = 0; p < 2; p++) {
          const s = p ? 15 : 0, len = p ? p2Len : p1Len;
          let k = 0; for (let d = s; d < s + len; d++) if (row[d] === 0) k++;
          let guard = 0;
          while (k < tgt[i][p] && guard++ < 1000) { const d = s + ri(len); if (!isF(i, d) && absOf(i, d) !== 7 && row[d] !== 0) { row[d] = 0; k++; } }
        }
        g.push(row);
      }
      return g;
    }
    function* anneal(iter) {
      let g = initial(), cur = cost(g), best = g.map(r => r.slice()), bestC = cur;
      const T0 = 200, T1 = 0.2;
      for (let it = 0; it < iter; it++) {
        if (it % 20000 === 0) yield it / iter;
        const T = T0 * Math.pow(T1 / T0, it / iter);
        const m = R(); let undo, touched = [];
        const moveOK = () => touched.every(([a, d]) => okVal(a, d, g[a][d]));
        if (m < 0.25) { // swap a block of days between two agents
          const a = ri(N), b = ri(N); if (a === b) continue;
          const k = 1 + ri(5), d0 = ri(D - k + 1);
          for (let d = d0; d < d0 + k; d++) touched.push([a, d], [b, d]);
          const sw = () => { for (let d = d0; d < d0 + k; d++) { const t = g[a][d]; g[a][d] = g[b][d]; g[b][d] = t; } };
          sw(); undo = sw;
        } else if (m < 0.45) { // rectangle: swap two days for two agents at once
          const a = ri(N), b = ri(N); if (a === b) continue;
          const p = R() < p1Len / D ? 0 : 1, s = p ? 15 : 0, len = p ? p2Len : p1Len;
          const d1 = s + ri(len), d2 = s + ri(len); if (d1 === d2) continue;
          touched = [[a, d1], [a, d2], [b, d1], [b, d2]];
          const sw = () => { let t = g[a][d1]; g[a][d1] = g[a][d2]; g[a][d2] = t; t = g[b][d1]; g[b][d1] = g[b][d2]; g[b][d2] = t; };
          sw(); undo = sw;
        } else if (m < 0.6) { // swap agents on a day
          const d = ri(D), a = ri(N), b = ri(N); if (a === b || g[a][d] === g[b][d]) continue; touched = [[a, d], [b, d]];
          [g[a][d], g[b][d]] = [g[b][d], g[a][d]]; undo = () => { [g[a][d], g[b][d]] = [g[b][d], g[a][d]]; };
        } else if (m < 0.8) { // swap two days same agent same period
          const a = ri(N), p = R() < p1Len / D ? 0 : 1, s = p ? 15 : 0, len = p ? p2Len : p1Len;
          const d1 = s + ri(len), d2 = s + ri(len); if (d1 === d2 || g[a][d1] === g[a][d2]) continue; touched = [[a, d1], [a, d2]];
          [g[a][d1], g[a][d2]] = [g[a][d2], g[a][d1]]; undo = () => { [g[a][d1], g[a][d2]] = [g[a][d2], g[a][d1]]; };
        } else { // set cell
          const a = ri(N), d = ri(D); if (isF(a, d)) continue; const old = g[a][d];
          const ab = absOf(a, d);
          if (ab === 7) continue;
          const cands = ab ? [0, ab] : [0, 4, homeOf(a, d), homeOf(a, d), 1 + ri(3)];
          const nv = cands[ri(cands.length)]; if (nv === old) continue;
          g[a][d] = nv; touched = [[a, d]]; undo = () => { g[a][d] = old; };
        }
        if (!moveOK()) { undo(); continue; }
        const nc = cost(g);
        if (nc <= cur || R() < Math.exp((cur - nc) / T)) { cur = nc; if (cur < bestC) { bestC = cur; best = g.map(r => r.slice()); } }
        else undo();
      }
      return { g: best, c: bestC };
    }
    // greedy repair: the annealer sometimes leaves one shift short when a day has only one legal filling
    function repair(g) {
      // Greedy chain repair: fill a short shift by moving one agent, and if that empties another
      // shift, move a second (and third) agent to cover it. Only accepted when the total cost drops.
      let cur = cost(g);
      const cands = (d, s2) => { const out = []; for (let i = 0; i < N; i++) if (okVal(i, d, s2) && g[i][d] !== s2) out.push(i); return out; };
      for (let pass = 0; pass < 4; pass++) {
        let moved = false;
        for (let d = 0; d < D; d++) for (let s1 = 1; s1 <= 3; s1++) {
          let cnt = 0; for (let i = 0; i < N; i++) if (g[i][d] === s1) cnt++;
          if (cnt >= 2) continue;
          for (const i of cands(d, s1)) {
            const oi = g[i][d]; g[i][d] = s1;
            if (cost(g) < cur) { cur = cost(g); moved = true; break; }
            if (oi >= 1 && oi <= 3) {
              let ok = false;
              for (const j of cands(d, oi)) {
                if (j === i) continue;
                const oj = g[j][d]; g[j][d] = oi;
                if (cost(g) < cur) { cur = cost(g); moved = true; ok = true; break; }
                if (oj >= 1 && oj <= 3) {
                  for (const k of cands(d, oj)) {
                    if (k === i || k === j) continue;
                    const okd = g[k][d]; if (okd !== 0 && okd !== 4) continue;
                    g[k][d] = oj;
                    if (cost(g) < cur) { cur = cost(g); moved = true; ok = true; break; }
                    g[k][d] = okd;
                  }
                  if (ok) break;
                }
                g[j][d] = oj;
              }
              if (ok) break;
            }
            g[i][d] = oi;
          }
        }
        if (!moved) break;
      }
      return g;
    }
    const restarts = opts.restarts ?? 6, iters = opts.iters ?? 400000;
    function finish(best) {
      const det = cost(best.g, true);
      return { year, month, days: D, grid: best.g, home, offTarget, targets: tgt, cuts: det.cuts,
        input: { prevLast: prevLast.slice(), prevStreak: prevStreak.slice() }, cost: det.cost, violations: det.violations,
        carry: { prevHome: home[1].slice(), prevLast: best.g.map(r => r[D - 1]),
          prevStreak: best.g.map(r => { let k = 0; for (let d = D - 1; d >= 0 && WORK(r[d]); d--) k++; return k; }),
          prevOff: best.g.map(r => { let k = 0; for (let d = D - 1; d >= 0 && r[d] === 0; d--) k++; return k; }) } };
    }
    function* all() {
      let best = null;
      for (let r = 0; r < restarts; r++) {
        const gen = anneal(iters); let x;
        while (!(x = gen.next()).done) yield (r + x.value) / restarts;
        const g2 = repair(x.value.g), c2 = cost(g2);
        if (!best || c2 < best.c) best = { g: g2, c: c2 };
      }
      return finish(best);
    }
    if (opts.score) { const det = cost(opts.score, true); return { cost: det.cost, violations: det.violations, cuts: det.cuts }; }
    if (opts.async) {
      return new Promise((res, rej) => {
        const gen = all();
        const step = () => { if (opts.cancel && opts.cancel()) { rej(new Error('cancelled')); return; }
          const t = Date.now(); let x;
          do { x = gen.next(); } while (!x.done && Date.now() - t < 40);
          if (x.done) res(x.value); else { opts.onProgress && opts.onProgress(x.value); setTimeout(step, 0); } };
        step();
      });
    }
    const gen = all(); let x; while (!(x = gen.next()).done); return x.value;
  }
  return { buildMonth, restOK, SH, OC_END, WORK, RESTDAY };
})();
export default SchedEngine;
export const { buildMonth, restOK, SH, OC_END, WORK, RESTDAY } = SchedEngine;
