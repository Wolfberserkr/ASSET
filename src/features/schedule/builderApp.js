// Team Schedule Builder — the reference page's script (reference/team-schedule-builder.html),
// ported as a mountable module. The page logic is unchanged; only the integration points differ:
//   · DOM lookups are scoped to `rootEl`, and document/window listeners are removed on unmount
//   · state lives in the shared Supabase workspace (debounced save, optimistic version lock),
//     with localStorage kept only as an offline draft cache
//   · builds run in a Vite module worker (engine.worker.js), with the in-page fallback kept
//   · Excel export is a normal browser download (xlsx-js-style)
//   · a Publish / Republish (and, for the Director, Unpublish) step was added
import { toPublished } from './publishShape.js';
import E from './engine.js';

const DRAFT_KEY = 'schedule-builder-draft-v1';
const SAVE_DELAY_MS = 1500;

export function mount(rootEl, opts = {}) {
const { initial = {}, storage, publish, unpublish, listPublished, canUnpublish = false, download } = opts;
let DEAD = false;
const LISTENERS = [];
const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); LISTENERS.push([target, type, fn, o]); };
const JOBS = new Set();

// Heavy builds run in a background worker so the page never freezes; if the browser blocks workers,
// the same engine runs on the page in small slices instead. Either way the build can be cancelled.
let WORKER_OK = true;
function runBuild(opts, onProgress){
  let cancelled=false, worker=null, cancelWorker=null;
  const stop=()=>{ if(worker){ worker.terminate(); worker=null; } };
  const inPage=()=>E.buildMonth(Object.assign({},opts,{async:true,onProgress,cancel:()=>cancelled}));
  const promise=new Promise((res,rej)=>{
    if(typeof Worker==='undefined') WORKER_OK=false;
    if(!WORKER_OK){ inPage().then(res,rej); return; }
    let heard=false;
    try{
      worker=new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' });
    }catch(e){ WORKER_OK=false; stop(); inPage().then(res,rej); return; }
    worker.onmessage=e=>{ heard=true; const m=e.data;
      if(m.p!=null){ onProgress&&onProgress(m.p); return; }
      stop(); if(m.done) res(m.done); else rej(new Error(m.err||'failed')); };
    worker.onerror=ev=>{ ev.preventDefault&&ev.preventDefault(); stop();
      if(cancelled){ rej(new Error('cancelled')); return; }
      if(!heard){ WORKER_OK=false; inPage().then(res,rej); } else rej(new Error('failed')); };
    worker.postMessage(opts);
    cancelWorker=()=>{ if(worker){ stop(); rej(new Error('cancelled')); } };
  });
  const job={ promise, cancel(){ cancelled=true; cancelWorker&&cancelWorker(); } };
  JOBS.add(job); const done=()=>JOBS.delete(job); promise.then(done,done);
  return job;
}
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const LBL=['OFF','05:00','13:00','21:00','18:00','VAC','SICK','TRN','X OFF','—']; // cells show the start time only
const FULL={1:'05:00–14:00 (Morning)',2:'13:00–22:00 (Afternoon)',3:'21:00–05:00 (Night)',4:'18:00–03:00 (Late swing)'};
const OC_FULL={1:'05:00–13:00',2:'13:00–21:00',3:'21:00–05:00',4:'18:00–03:00'}; // called in on a day off: 8 hours
const isOC=(i,d)=>!!(S.result.oc&&S.result.oc.includes(i+':'+d));
const isDS=(i,d)=>!!(S.result.ds&&S.result.ds.includes(i+':'+d));
const DS_FULL={1:'05:00–22:00',2:'13:00–05:00',3:'21:00–14:00 next day'};
const DS_END={1:22,2:29,3:38};
const nextShift=v=>v===3?1:v+1;
// how many agents are on each shift that day, counting double shifts and the supervisor
function cover(d,s){ const r=S.result, g=r.grid; let c=0;
  for(let i=0;i<g.length;i++){ const v=g[i][d];
    if(v===s) c++;
    if(isDS(i,d)&&v>=1&&v<=3&&nextShift(v)===s&&v<3) c++;
    if(d>0&&s===1&&g[i][d-1]===3&&isDS(i,d-1)) c++; }
  if(s<4) c+=supOn(d,s);
  if(d===0&&s===1&&r.preCover&&r.preCover[1]) c+=r.preCover[1]; // a night double shift from last month runs to 14:00
  return c; }
const cellLab=(v,oc,dsx)=>LBL[v]+(oc&&v>=1&&v<=4?'-off':'')+(dsx&&v>=1&&v<=3?' DS':'');
const optsFor=rest=>[[1,LBL[1],(rest?'Comes in on a day off · ':'Morning · ')+(rest?OC_FULL[1]:'05:00–14:00')],
  [2,LBL[2],(rest?'Comes in on a day off · ':'Afternoon · ')+(rest?OC_FULL[2]:'13:00–22:00')],
  [3,LBL[3],(rest?'Comes in on a day off · ':'Night · ')+(rest?OC_FULL[3]:'21:00–05:00')],
  [4,LBL[4],'Late swing · 18:00–03:00'],[0,'OFF','Day off'],[8,'X OFF','Extra day off requested'],
  [6,'SICK','Sick day (called in sick)'],[5,'VAC','Last-minute vacation day']];
const TYPE={5:'Vacation',6:'Sick leave',7:'Cross-training'};
const WORK=v=>v>=1&&v<=7, RESTD=v=>v===0||v===8;
const SNAME={1:'Morning',2:'Afternoon',3:'Night',4:'Extra · 18:00 / cover'};
let N=9; const MAXRUN=5;
let BUSY=false; // true while a schedule is being built
const STD_NAMES=['B-24','B-18','B-21','B-12','B-14','B-17','B-26','B-19','B-16']; // IDs only, no names
const SUP_ID='B-20'; // supervisor
const supHours=m=>m<6?{h:[7,16],lab:'07:00',full:'07:00–16:00'}:{h:[19,28],lab:'19:00',full:'19:00–04:00'}; // Jan–Jun days, Jul–Dec nights
const supDefault=(y,m,prev)=>{ // off every Sunday & Monday; code 11 = last half-year's hours (bridging the Jan 1 / Jul 1 switch)
  const out=Array.from({length:dim(y,m)},(_,d)=>{ const w=new Date(y,m,d+1).getDay(); return w===0||w===1?0:10; });
  if(prev&&prev.last===10&&prev.lab!==supHours(m).lab&&24+supHours(m).h[0]-prev.h[1]<11)
    for(let d=0;d<out.length&&out[d]===10;d++) out[d]=11; // keep the old hours until his first day off
  return out; };
const supAlt=m=>supHours(m<6?6:0); // the other half of the year
const PATTERN=[1,3,2]; // rows repeat Morning, Night, Afternoon
const RS=()=>S.rowShift; const RN=()=>S.rowShift.length;
const up=r=>r<0?r:(r+RN()-1)%RN(); // move up one row each schedule (extras stay extra)
const homeOfRow=k=>k<0?4:RS()[k];
const orderOf=rows=>[...rows.keys()].sort((a,b)=>(rows[a]<0?99:rows[a])-(rows[b]<0?99:rows[b]));
const SEED={"grid": [[1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 2, 2, 2, 2, 4, 0, 2, 2, 2, 2, 4, 0, 0, 2], [3, 4, 3, 3, 0, 3, 3, 4, 3, 3, 0, 0, 3, 3, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1], [2, 2, 4, 4, 0, 2, 2, 2, 4, 0, 0, 2, 2, 2, 0, 3, 3, 3, 3, 3, 0, 0, 3, 3, 3, 3, 0, 0, 3, 3, 3], [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 4, 0, 0, 1, 2, 2, 2, 2, 0, 0, 2, 2, 2, 0, 0, 2, 2, 2, 2, 4], [3, 3, 3, 3, 3, 0, 0, 3, 3, 3, 3, 3, 0, 0, 3, 3, 4, 0, 1, 1, 1, 1, 4, 0, 0, 1, 1, 1, 1, 4, 0], [2, 0, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 0, 2, 2, 0, 0, 3, 3, 3, 3, 4, 0, 3, 3, 3, 3, 4, 0, 3], [4, 0, 0, 1, 1, 1, 1, 4, 0, 1, 1, 1, 1, 1, 0, 1, 2, 0, 0, 2, 2, 2, 2, 0, 2, 2, 0, 2, 2, 2, 2], [4, 3, 0, 0, 3, 3, 3, 3, 0, 0, 3, 3, 3, 3, 3, 0, 1, 1, 1, 1, 4, 0, 1, 1, 1, 1, 4, 0, 0, 1, 1], [0, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 0, 2, 2, 4, 3, 3, 0, 0, 3, 3, 3, 3, 0, 0, 3, 3, 3, 3, 4]], "home": [[1, 3, 2, 1, 3, 2, 1, 3, 2], [2, 1, 3, 2, 1, 3, 2, 1, 3]], "offTarget": [4, 4], "rows": [[0, 1, 2, 3, 4, 5, 6, 7, 8], [8, 0, 1, 2, 3, 4, 5, 6, 7]]};
const $=id=>rootEl.querySelector('#'+id);
const dim=(y,m)=>new Date(y,m+1,0).getDate();
const STD_OFF=4; const defOff=()=>STD_OFF; // standard: 4 days off in each schedule

const fresh = () => ({
  year:2026, month:9, names:STD_NAMES.slice(), ids:STD_NAMES.map((_,i)=>'a'+(i+1)), nextId:10, rowShift:[1,3,2,1,3,2,1,3,2], pending:[],
  rows:SEED.rows[0].slice(), absences:[], holidays:[], lock:0, prevLast:Array(9).fill(0), prevStreak:Array(9).fill(0), prevOff:Array(9).fill(0),
  off:[STD_OFF,STD_OFF], offStd:1, result:JSON.parse(JSON.stringify({grid:SEED.grid,home:SEED.home,rows:SEED.rows,year:2026,month:9,names:STD_NAMES,ids:STD_NAMES.map((_,i)=>'a'+(i+1)),sup:supDefault(2026,9)}))
});
let S = fresh();
let LOAD_NOTE='';
const okState=x=>x&&Array.isArray(x.names)&&x.names.length&&x.result&&Array.isArray(x.result.grid)&&x.result.grid.length
    &&x.result.grid.every(r=>Array.isArray(r)&&r.length===dim(x.result.year,x.result.month))&&x.result.home&&x.result.rows;
// employee IDs follow ASSET: B-24. Older saves used ID-24 or a bare number.
const toB=n=>typeof n==='string'&&/^\s*(ID\s*-?\s*)?\d+\s*$/i.test(n)?'B-'+n.replace(/\D/g,''):n;
// The reference page's start-up checks and migrations, applied to whatever state was loaded.
function adopt(saved){
S=fresh();
if(saved&&okState(saved)) S=saved; else if(saved){ LOAD_NOTE='The saved schedule was damaged, so the page started fresh.'; }
if(!S.offStd){ if(S.result&&!S.result.offTarget&&!S.result.targets) S.result.offTarget=(S.off||[4,5]).slice(); S.off=[STD_OFF,STD_OFF]; S.offStd=1; }
S.absences=S.absences||[]; S.holidays=S.holidays||[]; S.lock=S.lock||0;
// roster migration (older saves had a fixed 9-agent team)
if(!S.ids){ S.ids=S.names.map((_,i)=>'a'+(i+1)); S.nextId=S.names.length+1; }
if(!S.rowShift) S.rowShift=[1,3,2,1,3,2,1,3,2];
if(!S.pending) S.pending=[];
if(!S.prevOff) S.prevOff=S.prevLast.map(v=>v===0?1:0);
if(S.result&&!S.result.ids){ S.result.ids=S.ids.slice(); S.result.names=S.names.slice(); }
S.absences.forEach(a=>{ if(a.id===undefined){ a.id=S.ids[a.agent]; } });
S.names=S.names.map(toB); if(S.result&&S.result.names) S.result.names=S.result.names.map(toB); (S.pending||[]).forEach(x=>{ if(x.name) x.name=toB(x.name); });
if(S.result&&!S.result.sup) S.result.sup=supDefault(S.result.year,S.result.month);
N=S.names.length;
try{ S.absences.forEach(a=>{ if(a.ret===undefined){ const [y,m,d]=(a.to||a.from).split('-').map(Number); const t=new Date(y,m-1,d+1); a.ret=a.to?`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`:''; delete a.to; } }); }catch(e){}
}
// ---- storage: the shared Supabase workspace is the real copy (one row, optimistic `version` lock).
// localStorage is only an offline draft cache: used when the workspace is empty or unreachable.
let VERSION=initial.version??null;
let REMOTE_OK=!!storage&&!initial.error;
let CONFLICT=false;
const readDraft=()=>{ try{ return JSON.parse(localStorage.getItem(DRAFT_KEY)||'null'); }catch(e){ return null; } };
const writeDraft=()=>{ try{ localStorage.setItem(DRAFT_KEY,JSON.stringify(S)); }catch(e){ /* best-effort cache */ } };
if(initial.state) adopt(initial.state);
else { adopt(readDraft());
  if(!REMOTE_OK) LOAD_NOTE='Could not reach the server — showing the draft saved on this device. Changes are not shared until you reload.'; }
let SAVE_T=null, SAVING=false, DIRTY=false;
function syncUI(state){
  const el=$('syncNote'), rb=$('syncReload'); if(!el) return;
  const txt={pending:'Saving…',saving:'Saving…',saved:'All changes saved',error:'Could not save — retrying…',
    conflict:'Someone else changed the schedule — reload to see their version. Your changes since then are not saved.',
    offline:'Offline draft — changes stay on this device until you reload.'}[state]||'';
  el.textContent=txt; el.dataset.state=state; rb.hidden=!(state==='conflict'||state==='offline');
}
const save=()=>{ if(DEAD) return; writeDraft();
  if(!REMOTE_OK||CONFLICT) return;
  DIRTY=true; clearTimeout(SAVE_T); SAVE_T=setTimeout(flushSave,SAVE_DELAY_MS); syncUI('pending'); };
async function flushSave(){
  clearTimeout(SAVE_T); SAVE_T=null;
  if(SAVING||!DIRTY||CONFLICT||!REMOTE_OK) return;
  SAVING=true; DIRTY=false; if(!DEAD) syncUI('saving');
  try{ VERSION=await storage.save(JSON.parse(JSON.stringify(S)),VERSION); if(!DIRTY&&!DEAD) syncUI('saved'); }
  catch(e){ if(e&&e.code==='CONFLICT'){ CONFLICT=true; if(!DEAD) syncUI('conflict'); }
    else { DIRTY=true; if(!DEAD){ syncUI('error'); SAVE_T=setTimeout(flushSave,10000); } } }
  finally{ SAVING=false;
    if(DIRTY&&!CONFLICT&&!SAVE_T){ if(DEAD) flushSave(); else SAVE_T=setTimeout(flushSave,SAVE_DELAY_MS); } }
}
// ---- undo history (last 50 actions, this page session)
const HIST=[];
function snap(label){ HIST.push({label,state:JSON.stringify(S)}); if(HIST.length>50) HIST.shift(); undoUI(); }
function undoUI(){ const b=$('undo'); const h=HIST[HIST.length-1];
  b.disabled=!h; b.textContent=h?`Undo: ${h.label}`:'Undo'; b.title=h?`Undo ${h.label.toLowerCase()} (${HIST.length} step${HIST.length>1?'s':''} available)`:'Nothing to undo'; }

// ---- controls
MONTHS.forEach((m,i)=>{const o=document.createElement('option');o.value=i;o.textContent=m;$('mon').appendChild(o);});
function syncControls(){
  $('mon').value=S.month; $('yr').value=S.year; $('off1').value=S.off[0]; $('off2').value=S.off[1];
  const D=dim(S.year,S.month); $('off2l').textContent=`Days off, 16–${D}`;
  $('offnote').textContent=`Standard is ${STD_OFF} days off in each schedule. Agents work ${15-S.off[0]} + ${D-15-S.off[1]} shifts; anyone not needed on a main shift goes to 18:00–03:00.`;
}
function onMonthChange(){
  if(BUSY) return;
  snap('Change month');
  S.month=+$('mon').value; S.year=+$('yr').value||S.year;
  const D=dim(S.year,S.month); S.off=[defOff(15),defOff(D-15)]; syncControls(); save();
}
$('mon').addEventListener('change',onMonthChange); $('yr').addEventListener('change',onMonthChange);
$('off1').addEventListener('change',()=>{if(BUSY)return;snap('Change days off');S.off[0]=$('off1').value===''?STD_OFF:Math.max(0,+$('off1').value);syncControls();save();});
$('off2').addEventListener('change',()=>{if(BUSY)return;snap('Change days off');S.off[1]=$('off2').value===''?STD_OFF:Math.max(0,+$('off2').value);syncControls();save();});

function agentRows(){
  const tb=$('agentRows'); tb.innerHTML='';
  for(let i=0;i<N;i++){
    const tr=document.createElement('tr');
    const opt=(vals,sel)=>vals.map(([v,t])=>`<option value="${v}"${v==sel?' selected':''}>${t}</option>`).join('');
    tr.innerHTML=`<td><input type="text" id="nm${i}" aria-label="ID of agent ${i+1}"></td>
      <td><select id="sh${i}" aria-label="Row for agent ${i+1}">${opt(RS().map((sh,k)=>[k,`Row ${k+1} · ${SNAME[sh]}`]).concat([[-1,'Extra · 18:00 / cover']]),S.rows[i])}</select></td>
      <td><select id="pl${i}" aria-label="Last shift for agent ${i+1}">${opt([[0,'Off / unknown'],[1,'05-14'],[2,'13-22'],[3,'21-05'],[4,'18-03']],S.prevLast[i])}</select></td>
      <td><input type="number" min="0" max="5" id="ps${i}" value="${S.prevStreak[i]}" aria-label="Streak for agent ${i+1}"></td>
      <td class="rm-cell">${pendTag(S.ids[i])||`<button class="linkbtn" data-leave="${i}">Remove…</button>`}</td>`;
    tb.appendChild(tr);
    const nm=tr.querySelector('#nm'+i); nm.value=S.names[i];
    nm.addEventListener('focus',()=>{nm._snapped=false;});
    nm.addEventListener('keydown',e=>{ if(e.key!=='Enter') return; e.preventDefault(); // Enter → next name (Shift+Enter → previous)
      const nx=$('nm'+(i+(e.shiftKey?-1:1))); if(nx){ nx.focus(); nx.select(); } else nm.blur(); });
    nm.addEventListener('input',()=>{ const val=normId(nm.value);
      nm.classList.toggle('bad',!ID_RE.test(val));
      if(!ID_RE.test(val)){ $('msg').textContent='IDs must look like B-24 (letter "B-" then numbers only).'; return; }
      if(S.names.some((n,k)=>k!==i&&n===val)){ nm.classList.add('bad'); $('msg').textContent=`${val} is already on the team.`; return; }
      if(!nm._snapped){snap('Change ID');nm._snapped=true;} S.names[i]=val;renderGrids();absUI();save(); $('msg').textContent=''; });
    nm.addEventListener('blur',()=>{ nm.value=S.names[i]; nm.classList.remove('bad'); });
    tr.querySelector('#sh'+i).addEventListener('change',e=>{snap('Change row');S.rows[i]=+e.target.value;save();rowCheck();});
    tr.querySelector('#pl'+i).addEventListener('change',e=>{snap('Change last shift');S.prevLast[i]=+e.target.value; if(S.prevOff) S.prevOff[i]=S.prevLast[i]===0?1:0;save();});
    tr.querySelector('#ps'+i).addEventListener('keydown',e=>{ if(e.key!=='Enter') return; e.preventDefault(); // Enter → next row (Shift+Enter → previous)
      const nx=$('ps'+(i+(e.shiftKey?-1:1))); if(nx){ nx.focus(); nx.select(); } else e.target.blur(); });
    tr.querySelector('#ps'+i).addEventListener('change',e=>{snap('Change days in a row');S.prevStreak[i]=+e.target.value||0;save();});
  }
}

function rowCheck(){
  const core=S.rows.filter(x=>x>=0); const dup=core.length!==new Set(core).size;
  if(dup){ $('msg').textContent='Two agents are in the same row. Give each agent a different row.'; }
  return !dup;
}
// ---- team changes (hire / leave), effective from the start of a schedule
const fmtIso=k=>{ const [y,m,d]=k.split('-').map(Number); return `${d} ${MONTHS[m-1].slice(0,3)}`; };
function starts(){ const r=S.result, y=r.year, m=r.month, ny=m===11?y+1:y, nmn=(m+1)%12;
  return [{from:iso(y,m,16),mid:true,label:`16 ${MONTHS[m].slice(0,3)}`,last:`15 ${MONTHS[m].slice(0,3)}`},
          {from:iso(ny,nmn,1),mid:false,label:`1 ${MONTHS[nmn].slice(0,3)}`,last:`${dim(y,m)} ${MONTHS[m].slice(0,3)}`}]; }
function pendTag(id){ const k=S.pending.findIndex(p=>p.kind==='leave'&&p.id===id); if(k<0) return '';
  return `<span class="tag">Last day ${S.pending[k].last}</span><button class="linkbtn" data-cancel="${k}">Undo leaving</button>`; }
function renderPending(){
  const hs=S.pending.map((p,k)=>p.kind==='hire'?`<div><span class="tag">Starts ${fmtIso(p.from)}</span><b>${esc(p.name)}</b> <button class="linkbtn" data-cancel="${k}">Cancel</button></div>`:'').join('');
  $('pendList').innerHTML=hs;
  $('hireFrom').innerHTML=starts().map((o,k)=>`<option value="${k}">${o.label}${o.mid?' (this month)':''}</option>`).join('');
  $('hireFrom').value='1';
}
function applyPending(monthStart){ // apply hires/leaves due by this month's first day; returns how many
  let n=0;
  S.pending=S.pending.filter(p=>{ if(p.from>monthStart) return true; n++;
    if(p.kind==='leave'){ const i=S.ids.indexOf(p.id); if(i<0) return false; const row=S.rows[i];
      ['names','ids','rows','prevLast','prevStreak','prevOff'].forEach(k=>S[k].splice(i,1));
      if(row>=0){ S.rowShift.splice(row,1); S.rows=S.rows.map(x=>x>row?x-1:x); S.rowShift=S.rowShift.map((_,k)=>PATTERN[k%3]); }
      S.absences=S.absences.filter(a=>a.id!==p.id); }
    else { S.names.push(p.name); S.ids.push(p.id); S.prevLast.push(0); S.prevStreak.push(0); S.prevOff.push(0); S.rows.push(-1); }
    return false; });
  // an open row goes to an extra agent (longest-serving extra first)
  for(let i=0;i<S.rows.length&&RN()<9;i++) if(S.rows[i]<0){ S.rowShift.push(PATTERN[RN()%3]); S.rows[i]=RN()-1; }
  S.rowShift=S.rowShift.map((_,k)=>PATTERN[k%3]); // keep Morning / Night / Afternoon repeating so moving up a row always moves a shift forward
  N=S.names.length; return n;
}
on(document,'click',e=>{
  if(BUSY) return;
  const lv=e.target.closest('[data-leave]');
  if(lv){ const i=+lv.dataset.leave, cell=lv.parentElement;
    cell.innerHTML=starts().map((o,k)=>`<button class="linkbtn" data-leaveopt="${i}:${k}">Last day ${o.last}</button>`).join(' ')+` <button class="linkbtn" data-leavecancel>Keep</button>`;
    cell.querySelector('button').focus(); return; }
  if(e.target.closest('[data-leavecancel]')){ agentRows(); return; }
  const lo=e.target.closest('[data-leaveopt]');
  if(lo){ const [i,k]=lo.dataset.leaveopt.split(':').map(Number), o=starts()[k], id=S.ids[i], nmx=S.names[i];
    snap(`${nmx} leaves`);
    const nxt=starts()[1].from; S.pending.push({kind:'leave',id,from:nxt,last:o.last});
    let msg=`${nmx} leaves after ${o.last}. Their row is removed from ${starts()[1].label}.`;
    if(o.mid){ const r=S.result, ri=(r.ids||[]).indexOf(id);
      if(ri>=0){ for(let d=15;d<r.grid[ri].length;d++) r.grid[ri][d]=9;
        if(r.dbl) r.dbl=r.dbl.filter(x=>{ const [a,d]=x.split(':').map(Number); return !(a===ri&&d>=15); });
        msg+=' Their shifts from the 16th are cleared — see the suggested fixes to cover them.'; } }
    save(); agentRows(); renderGrids(); $('msg').textContent=msg; return; }
  const cc=e.target.closest('[data-cancel]');
  if(cc){ const p=S.pending[+cc.dataset.cancel]; if(!p) return;
    if(p.kind==='leave'){ const r=S.result, ri=(r.ids||[]).indexOf(p.id);
      if(ri>=0&&r.grid[ri].slice(15).every(v=>v===9)){ $('msg').textContent='Their shifts from the 16th were already cleared — use Undo to bring them back.'; return; } }
    snap('Cancel team change'); S.pending.splice(+cc.dataset.cancel,1); save(); agentRows(); renderPending(); $('msg').textContent='Team change cancelled.'; return; }
});
$('hireAdd').addEventListener('click',async()=>{
  const name=normId($('hireName').value);
  if(!ID_RE.test(name)){ $('msg').textContent='Type the new agent\'s ID, like B-27.'; $('hireName').focus(); return; }
  if(S.names.includes(name)||S.pending.some(p=>p.name===name)){ $('msg').textContent=`${name} is already on the team.`; return; }
  const o=starts()[+$('hireFrom').value]; const id='a'+(S.nextId++);
  if(!o.mid){ snap(`Add ${name}`); S.pending.push({kind:'hire',id,name,from:o.from}); $('hireName').value=''; save(); renderPending();
    $('msg').textContent=`${name} starts ${o.label}. They'll be added when you set up and build that month.`; return; }
  // starts on the 16th of the schedule on screen: fill their second half without moving anyone else
  const r=S.result, D=r.grid[0].length, btn=$('hireAdd'); $('msg').textContent=`Adding ${name} from ${o.label}…`;
  snap(`Add ${name}`); setBusy(true);
  const token=JSON.stringify([r.year,r.month,r.ids,r.grid]);
  const n=r.grid.length, fixed=r.grid.map(row=>row.slice()); fixed.push(Array.from({length:D},(_,d)=>d<15?9:null));
  const ids=r.ids.concat([id]);
  const res=await runBuild({...nextInfo(r.year,r.month,ids),agents:n+1,extras:r.rows[1].map((x,i)=>x<0?i:-1).filter(x=>x>=0).concat([n]),fixed,absence:fixedFor(r.year,r.month,ids),
    mustWork:mustWorkFor(r.year,r.month,ids),dbl:r.dbl||[],year:r.year,month:r.month,startHome:r.home[0].concat([4]),
    prevLast:(r.prevLast||S.prevLast).concat([0]),prevStreak:(r.prevStreak||S.prevStreak).concat([0]),prevOff:(r.prevOff||S.prevOff||[]).concat([0]),
    maxRun:MAXRUN,offP1:(r.offTarget||S.off)[0],offP2:(r.offTarget||S.off)[1],seed:(Math.random()*1e9)|0,restarts:3,iters:150000}).promise;
  setBusy(false);
  if(S.result!==r||JSON.stringify([r.year,r.month,r.ids,r.grid])!==token){ HIST.pop(); undoUI(); $('msg').textContent='The schedule changed while the new agent was being added — nothing was changed. Try again.'; return; }
  r.grid.push(res.grid[n]); r.home[0].push(4); r.home[1].push(4); r.rows[0].push(-1); r.rows[1].push(-1);
  r.ids.push(id); r.names=(r.names||[]).concat([name]); if(r.targets) r.targets.push(res.targets[n]); if(r.absence) r.absence.push(Array(D).fill(null));
  if(r.prevLast) r.prevLast.push(0); if(r.prevStreak) r.prevStreak.push(0); if(r.prevOff) r.prevOff.push(0);
  S.names.push(name); S.ids.push(id); S.rows.push(-1); S.prevLast.push(0); S.prevStreak.push(0); S.prevOff.push(0); N=S.names.length;
  $('hireName').value=''; save(); agentRows(); absUI(); renderPending(); renderGrids();
  $('msg').textContent=`${name} added from ${o.label} as an extra on 18:00–03:00 — nobody else's shifts changed.`;
});
// ---- absences
const iso=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
// Absences run from `from` up to the day before `ret` (the return-to-work day). Blank `ret` = still out.
const addDay=(k,n)=>{ const [y,m,d]=k.split('-').map(Number); const t=new Date(y,m-1,d+n); return iso(t.getFullYear(),t.getMonth(),t.getDate()); };
function fixedFor(y,m,ids){ // ids = agent ids in grid order (default: current roster)
  ids=ids||S.ids; const D=dim(y,m), f=Array.from({length:ids.length},()=>Array(D).fill(null));
  S.absences.forEach(a=>{ const i=ids.indexOf(a.id); if(i<0) return; for(let d=0;d<D;d++){ const k=iso(y,m,d+1); if(k>=a.from&&(!a.ret||k<a.ret)) f[i][d]=a.type; } });
  return f;
}
function nextInfo(y,m,ids){ // who is away / due back on the 1st of the following month
  ids=ids||S.ids; const ny=m===11?y+1:y, nm=(m+1)%12, ab=fixedFor(ny,nm,ids), mw=new Set(mustWorkFor(ny,nm,ids));
  return {nextAbs:ab.map(row=>row[0]||0), nextMust:ids.map((_,i)=>mw.has(i+':0')?1:0)};
}
function mustWorkFor(y,m,ids){ // return-to-work days in this month: agent must be on a shift
  ids=ids||S.ids; const D=dim(y,m), out=[], ab=fixedFor(y,m,ids);
  S.absences.forEach(a=>{ const i=ids.indexOf(a.id); if(i<0||!a.ret) return; for(let d=0;d<D;d++) if(iso(y,m,d+1)===a.ret&&!ab[i][d]) out.push(i+':'+d); });
  return out;
}
// Apply absence changes to the current schedule on the affected days only (no rebuild).
function applyAbsences(){
  const r=S.result, g=r.grid, D=g[0].length, nw=fixedFor(r.year,r.month,r.ids), old=r.absence||[];
  const pick=(i,d)=>{ const h=r.home[d<15?0:1][i], c=s=>g.filter((row,k)=>k!==i&&row[d]===s).length;
    if(c(h)<2) return h; for(const s of [1,2,3]) if(c(s)<2) return s; return 4; };
  let changed=0;
  for(let i=0;i<g.length;i++) for(let d=0;d<D;d++){
    const o=(old[i]&&old[i][d])||0, n=nw[i][d]||0, v=g[i][d]; if(v===9) continue;
    if(n&&!o){ if(n===7||(v>=1&&v<=4)){ g[i][d]=n; changed++; } }
    else if(n&&o&&n!==o){ if(v===o){ g[i][d]=n; changed++; } }
    else if(!n&&o){ if(v===o){ g[i][d]=pick(i,d); changed++; } }
  }
  mustWorkFor(r.year,r.month,r.ids).forEach(k=>{ const [i,d]=k.split(':').map(Number); if(!(g[i][d]>=1&&g[i][d]<=4)){ g[i][d]=pick(i,d); changed++; } });
  r.absence=nw; r.mustWork=mustWorkFor(r.year,r.month,r.ids);
  if(S.result.dbl) S.result.dbl=S.result.dbl.filter(k=>{ const [i,d]=k.split(':').map(Number); return g[i][d]>=1&&g[i][d]<=4; });
  return changed;
}
function absChanged(label){
  const n=applyAbsences(); save(); absUI(); renderGrids();
  $('msg').textContent=n?`${label} — ${n} day${n>1?'s':''} updated on the schedule. Check the suggested fixes for any short shift.`:`${label}.`;
}
function absUI(){
  $('abA').innerHTML=S.names.map((n,i)=>`<option value="${esc(S.ids[i])}">${esc(n||'Agent '+(i+1))}</option>`).join('');
  const L=$('abList');
  if(!S.absences.length){ L.innerHTML='<tr><td colspan="5" class="empty">No absences or training entered.</td></tr>'; return; }
  L.innerHTML=S.absences.map((a,k)=>`<tr><td>${esc(S.names[S.ids.indexOf(a.id)]||'Former agent')}</td><td><span class="chip s${a.type}" style="color:var(--cell-ink)">${TYPE[a.type]}</span></td><td>${a.from}</td><td><input type="date" data-ret="${k}" value="${a.ret||''}" min="${addDay(a.from,1)}" aria-label="Back to work date"> <span class="tag">${a.ret?'':'Not known yet — still out'}</span></td><td><button data-rm="${k}">Remove</button></td></tr>`).join('');
}
$('abAdd').addEventListener('click',()=>{
  const f=$('abF').value, t=$('abTo').value;
  if(!f){ $('msg').textContent='Pick the first day of the absence.'; return; }
  if(t&&t<=f){ $('msg').textContent='The back-to-work date must be after the first day of the absence.'; return; }
  snap('Add absence');
  S.absences.push({id:$('abA').value,type:+$('abT').value,from:f,ret:t||''});
  $('abF').value=''; $('abTo').value='';
  const r=S.result, endK=iso(r.year,r.month,dim(r.year,r.month));
  if(f>endK){ save(); absUI(); renderGrids();
    const [fy,fm,fd]=f.split('-').map(Number), first=fm-1===(r.month+1)%12&&fd===1;
    $('msg').textContent=`Added for ${MONTHS[fm-1]} ${fy}. It goes on that month's schedule when you set it up${first?`, and the end of ${MONTHS[r.month]} is planned around it when you build or rebuild ${MONTHS[r.month]}`:''}.`; return; }
  absChanged('Added');
});
$('abList').addEventListener('click',e=>{ const b=e.target.closest('[data-rm]'); if(!b) return; snap('Remove absence'); S.absences.splice(+b.dataset.rm,1); absChanged('Removed'); });
$('abList').addEventListener('change',e=>{ const inp=e.target.closest('[data-ret]'); if(!inp) return; const a=S.absences[+inp.dataset.ret];
  if(inp.value&&inp.value<=a.from){ $('msg').textContent='The back-to-work date must be after the first day of the absence.'; inp.value=a.ret||''; return; }
  snap('Change back-to-work date'); a.ret=inp.value||''; absChanged('Back-to-work date changed'); });
$('lock').addEventListener('change',()=>{ snap('Change kept days'); S.lock=Math.max(0,+$('lock').value||0); save(); });
// ---- validation
function check(){
  const r=S.result, g=r.grid, D=g[0].length, Y=r.year, M=r.month;
  const issues=[], bad=new Set(); const cat={cover:0,rest:0,sun:0,off:0,run:0,orun:0,cut:0};
  const NX=nextInfo(Y,M,r.ids), OPEN=[0,0,0];
  const offT=r.offTarget||S.off;
  for(let d=0;d<D;d++){ const c=[0,0,0,0,0,0,0,0,0,0,0]; g.forEach(row=>c[row[d]]++); [1,2,3].forEach(s=>c[s]=cover(d,s));
    for(let s=1;s<=3;s++) if(c[s]!==2){cat.cover++; issues.push(`${M+1}/${d+1}: ${SNAME[s]} (${LBL[s]}) has ${c[s]} agent${c[s]===1?'':'s'}`);}
    if(c[4]&&[1,2,3].some(s=>c[s]<2)){cat.cover++; issues.push(`${M+1}/${d+1}: someone is on 18:00–03:00 while a main shift is short`);} }
  const suns=[]; for(let d=0;d<D;d++) if(new Date(Y,M,d+1).getDay()===0) suns.push(d);
  g.forEach((row,i)=>{
    const nm=rName(i); const ne=[row.slice(0,15).includes(9),row.slice(15).includes(9)];
    const os=[row.slice(0,15).filter(x=>x===0).length, row.slice(15).filter(x=>x===0).length];
    const tg=r.targets?r.targets[i]:offT;
    os.forEach((o,p)=>{ if(ne[p]) return; const lab=p?`16–${D}`:'1–15';
      if(o>tg[p]){cat.off++;issues.push(`${nm}: ${o} days off in ${lab} (target ${tg[p]})`);}
      else if(o<tg[p]){cat.cut+=tg[p]-o;} });
    if(!row.includes(9)&&!suns.some(d=>RESTD(row[d]))){cat.sun++;issues.push(`${nm}: no Sunday off this month`);}
    const prev=(r.prevLast||S.prevLast)[i];
    const endOf=d=>{ const x=row[d]; if(!E.SH[x]) return null; if(isDS(i,d)&&DS_END[x]) return DS_END[x];
      return isOC(i,d)?(E.OC_END[x]??E.SH[x][1]):E.SH[x][1]; };
    for(let d=0;d<D;d++) if(isDS(i,d)){
      let k=0; for(let x=d;x>=0&&WORK(row[x])&&!(r.dbl||[]).includes(i+':'+x)&&!isOC(i,x);x--) k++;
      if(k>4){cat.run++;bad.add(i+':'+d);issues.push(`${nm}: double shift on the ${d+1} after ${k} days in a row (max 4)`);}
      if(d+1<D&&!RESTD(row[d+1])&&row[d+1]!==9){cat.run++;bad.add(i+':'+(d+1));issues.push(`${nm}: no day off after the double shift on the ${d+1}`);} }
    { const pe=r.prevEnd&&r.prevEnd[i]!=null?r.prevEnd[i]:null, n=row[0];
      const short=pe!=null?(E.SH[n]&&24+E.SH[n][0]-pe<11):!E.restOK(prev,n);
      if(short){cat.rest++;bad.add(i+':0');issues.push(`${nm}: under 11 h rest going into the 1st`);}
      if(r.prevMustOff&&r.prevMustOff[i]&&WORK(n)){cat.run++;bad.add(i+':0');issues.push(`${nm}: must be off on the 1st after last month's double shift`);} }
    for(let d=0;d+1<D;d++){ const e=endOf(d), n=row[d+1];
      if(e!=null&&E.SH[n]&&24+E.SH[n][0]-e<11){cat.rest++;bad.add(i+':'+(d+1));issues.push(`${nm}: under 11 h rest between the ${d+1} and ${d+2}`);} }
    (r.mustWork||[]).forEach(k=>{ const [a,d]=k.split(':').map(Number); if(a===i&&!(row[d]>=1&&row[d]<=4)){ cat.ret=(cat.ret||0)+1; bad.add(i+':'+d); issues.push(`${nm}: back to work on the ${d+1} but not on a shift`); } });
    let orun=((r.prevOff||S.prevOff||[])[i])??((r.prevLast||S.prevLast)[i]===0?1:0);
    for(let d=0;d<D;d++){ orun=row[d]===0?orun+1:0; if(orun>2){cat.orun++;bad.add(i+':'+d);issues.push(`${nm}: ${orun} days off in a row by the ${d+1} (max 2)`);} }
    let run=(r.prevStreak||S.prevStreak)[i]||0; const dbl=new Set(r.dbl||[]);
    for(let d=0;d<D;d++){ if(dbl.has(i+':'+d)||isOC(i,d)){ run=0; continue; } run=WORK(row[d])?run+1:0; if(run>5){cat.run++;bad.add(i+':'+d);issues.push(`${nm}: ${run} days in a row by the ${d+1} (legal max 5)`);} }
    // look ahead to the 1st of next month (absences entered early)
    if(row[D-1]!==9){ const NMN=MONTHS[(M+1)%12];
      if(NX.nextMust[i]&&run>=MAXRUN){cat.run++;bad.add(i+':'+(D-1));issues.push(`${nm}: back to work on ${NMN} 1 after ${run} days in a row`);}
      const el=endOf(D-1);
      if(NX.nextAbs[i]===7&&el!=null&&el>22){cat.rest++;bad.add(i+':'+(D-1));issues.push(`${nm}: under 11 h rest before training on ${NMN} 1`);}
      if(!NX.nextAbs[i]&&run<MAXRUN&&!(isDS(i,D-1))){ const l=row[D-1]; if(l===0||l===8||l===1){OPEN[0]++;OPEN[1]++;OPEN[2]++;} else if(l===2){OPEN[1]++;OPEN[2]++;} else OPEN[2]++; } }
  });
  if(OPEN[0]<2||OPEN[1]<4||OPEN[2]<6){ cat.next=1; const NMN=MONTHS[(M+1)%12];
    issues.push(`${NMN} 1: not enough agents free to open next month (${OPEN[0]} for 05:00, ${OPEN[1]} for 05:00/13:00, ${OPEN[2]} in all) — rebuild this month or plan cover`); }
  const sp=r.sup||[]; // supervisor: rest between his own shifts and cover shifts
  if(r.supPrev&&r.supPrev.last){ const x=r.supPrev.last===10?r.supPrev.h:(r.supPrev.last>=1&&r.supPrev.last<=4?E.SH[r.supPrev.last]:null), y=supSH(sp[0],0);
    if(x&&y&&24+y[0]-x[1]<11){cat.rest++;bad.add('sup:0');issues.push(`${SUP_ID}: under 11 h rest going into the 1st (was on ${r.supPrev.lab} last month)`);} }
  for(let d=0;d+1<D;d++) if(!supRestOK(sp[d],sp[d+1],d,d+1)){cat.rest++;bad.add('sup:'+(d+1));issues.push(`${SUP_ID}: under 11 h rest between the ${d+1} and ${d+2}`);}
  return {issues,bad,cat};
}
function renderChecks(){
  const {issues,cat}=check();
  const items=[['cover','2 agents on every shift'],['rest','11 h+ rest between shifts'],['sun','Sunday off for everyone'],['off','No extra days off'],['run','Max 5 days in a row (incl. carry-over)'],['orun','Max 2 days off in a row']];
  $('checks').innerHTML=items.map(([k,t])=>`<span class="chip ${cat[k]?'bad':'ok'}">${cat[k]?'✕':'✓'} ${t}${cat[k]?` (${cat[k]})`:''}</span>`).join('')
    +(cat.ret?`<span class="chip bad">✕ Back-to-work day not on a shift (${cat.ret})</span>`:'')
    +(cat.next?`<span class="chip info">Next month's 1st is tight — see below</span>`:'')
    +(cat.cut?`<span class="chip info">${cat.cut} day${cat.cut>1?'s':''} off given up to cover shifts</span>`:'');
  $('issues').innerHTML=issues.slice(0,20).map(s=>`<li>${s.replace(/</g,'&lt;')}</li>`).join('');
  $('checksTitle').textContent=`Rule checks — ${MONTHS[S.result.month]} ${S.result.year}`;
}

// ---- grids
function renderGrid(tbl,d0,d1,p){
  const r=S.result, g=r.grid, Y=r.year, M=r.month; const {bad}=check(); const rows=r.rows[p], homes=r.home[p];
  let h='<thead><tr><th class="name">Agent</th>';
  for(let d=d0;d<d1;d++){const dt=new Date(Y,M,d+1);const sun=dt.getDay()===0;
    const hol=isHol(d);
    h+=`<th class="${sun?'sun':''}${hol?' hol':''}"><button class="dayh" data-day="${d}" aria-pressed="${hol}" title="${hol?'Holiday — every shift worked counts as a Double day. Click to remove.':'Click to mark as a holiday (every shift worked counts as a Double day)'}">${dt.toLocaleDateString('en-US',{weekday:'short'})}<br>${d+1}${hol?'<i>HOL</i>':''}</button></th>`;}
  h+='<th>Shifts</th><th>Off</th><th>18-03</th><th>Away</th><th>TRN</th><th title="Double days: holiday shifts + call-ins">DBL</th></tr></thead><tbody>';
  orderOf(rows).forEach(i=>{ const row=g[i];
    const emp=row.slice(d0,d1).some(v=>v!==9);
    h+=`<tr><th class="name">${nm(i)}<small>${emp?SNAME[homes[i]]:'Not on the team'}</small></th>`;
    let w=0,o=0,e=0,a=0,t=0,x2=0; const fx=r.fixedMask||[];
    for(let d=d0;d<d1;d++){const v=row[d]; if(v>=1&&v<=4)w++; if(v===0||v===8)o++; if(v===4)e++; if(v===5||v===6)a++; if(v===7)t++;
      const hx=isHol(d)&&isFloor(v); if(hx||isD(i,d)) x2++; const oc=isOC(i,d)&&v>=1&&v<=3, dsx=isDS(i,d)&&v>=1&&v<=3, dblc=isD(i,d)&&v>=1&&v<=4;
      const ab=(r.absence&&r.absence[i]&&r.absence[i][d])||0, isfx=ab>0; h+=`<td${isHol(d)?' class="holc"':''}><button class="cell s${v}${oc?' oc':''}${dblc?' dblc':''}${dsx?' ds':''}${isfx?' fx':''}${bad.has(i+':'+d)?' warn':''}" data-i="${i}" data-d="${d}"${isfx?` title="${TYPE[ab]} period — click to switch between ${LBL[ab]} and OFF"`:v===8?' title="Extra day off requested — kept when you rebuild"':''} aria-haspopup="menu" aria-label="${nm(i)} day ${d+1}: ${oc?'called in on a day off, ':''}${dsx?'double shift '+DS_FULL[v]:(v>=1&&v<=4?(oc?OC_FULL[v]:FULL[v]):LBL[v])}${isD(i,d)||hx?', Double day':''}">${cellLab(v,oc,dsx)}${isD(i,d)?'<i class="dblb">DBL</i>':''}</button></td>`;}
    h+=`<td class="tot">${w}</td><td class="tot">${o}</td><td class="tot">${e}</td><td class="tot">${a||''}</td><td class="tot">${t||''}</td><td class="tot">${x2||''}</td></tr>`;
  });
  { const sp=r.sup||[]; let w=0,o=0,cv=0;
    h+=`<tr class="supsep"><th class="name" colspan="${d1-d0+7}">Supervisor</th></tr><tr class="suprow"><th class="name">${SUP_ID}<small>Supervisor · ${supHours(M).full}</small></th>`;
    for(let d=d0;d<d1;d++){ const v=sp[d]??0; if(v===10||(v>=1&&v<=4)) w++; if(v===0) o++; if(v>=1&&v<=4) cv++;
      h+=`<td${isHol(d)?' class="holc"':''}><button class="cell s${v===10?'sup':v}${v>=1&&v<=4?' supcov':''}${supIsOC(d)&&v>=1&&v<=3?' oc':''}${bad.has('sup:'+d)?' warn':''}" data-sup="1" data-d="${d}" aria-haspopup="menu" aria-label="${SUP_ID} day ${d+1}: ${supLab(v,d)}${v>=1&&v<=4?' (covering)':''}"${v>=1&&v<=4&&supIsOC(d)?' title="Covering on his day off — 8-hour call-in"':''}>${supLab(v,d)}</button></td>`; }
    h+=`<td class="tot">${w}</td><td class="tot">${o}</td><td class="tot" title="Agent shifts covered">${cv||''}</td><td></td><td></td><td></td></tr>`; }
  [1,2,3,4].forEach(s=>{ h+=`<tr class="cov"><th class="name"><small>${LBL[s]} on duty</small></th>`;
    for(let d=d0;d<d1;d++){const c=s<4?cover(d,s):g.filter(row=>row[d]===s).length; h+=`<td class="${s<4&&c!==2?'badc':''}">${c}</td>`;}
    h+='<td></td><td></td><td></td><td></td><td></td><td></td></tr>'; });
  tbl.innerHTML=h+'</tbody>';
}
// ---- fix suggestions for short shifts
const isHol=d=>S.holidays.includes(iso(S.result.year,S.result.month,d+1));
const HOLAT=isHol; // exports: every shift worked on a holiday is a Double day
const isFloor=v=>v>=1&&v<=4;
const supIsOC=d=>!!(S.result.supOc&&S.result.supOc.includes(d));
const supLab=(v,d)=>v===11?supAlt(S.result.month).lab:v===10?supHours(S.result.month).lab:(LBL[v]+(d!==undefined&&supIsOC(d)&&v>=1&&v<=4?'-off':''));
const supSH=(v,d)=>v===11?supAlt(S.result.month).h:v===10?supHours(S.result.month).h:(v>=1&&v<=4?(d!==undefined&&supIsOC(d)?[E.SH[v][0],E.OC_END[v]]:E.SH[v]):null);
const supRestOK=(a,b,da,db)=>{ const x=supSH(a,da), y=supSH(b,db); return !x||!y||24+y[0]-x[1]>=11; };
const pin=(i,d)=>{ const r=S.result; r.pins=r.pins||[]; const k=i+':'+d; if(!r.pins.includes(k)) r.pins.push(k); }; // hand edits survive a rebuild
const supOffDay=d=>{ const w=new Date(S.result.year,S.result.month,d+1).getDay(); return w===0||w===1; };
const supOn=(d,s)=>(S.result.sup&&S.result.sup[d]===s)?1:0; // supervisor covering an agent shift counts as 1
const isD=(i,d)=>!!(S.result.dbl&&S.result.dbl.includes(i+':'+d));
const fmtD=d=>`${d+1} ${MONTHS[S.result.month].slice(0,3)}`;
const rName=i=>{ const r=S.result; const id=r.ids&&r.ids[i]; const k=id?S.ids.indexOf(id):-1; return (k>=0?S.names[k]:(r.names&&r.names[i]))||('Agent '+(i+1)); };
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const ID_RE=/^B-\d{1,6}$/;
function normId(v){ v=String(v||'').trim().toUpperCase(); return /^(ID|B)?\s*-?\s*\d{1,6}$/.test(v)?'B-'+v.replace(/\D/g,''):v; }
const nm=i=>esc(rName(i));
function scorer(){
  const r=S.result, D=r.grid[0].length;
  const fixed=r.grid.map(row=>row.map(v=>v===8?8:null));
  const extras=r.rows[1].map((x,i)=>x<0?i:-1).filter(x=>x>=0);
  const nx=nextInfo(r.year,r.month,r.ids);
  return (g,extraDbl,extraOc,extraDs)=>E.buildMonth({...nx,prevEnd:r.prevEnd||null,prevMustOff:r.prevMustOff||[],preCover:r.preCover||{},
    supCover:(r.sup||[]).map(v=>v>=1&&v<=3?v:0),ds:(r.ds||[]).concat(extraDs||[]),oc:(r.oc||[]).concat(extraOc||[]),agents:r.grid.length,extras,dbl:(r.dbl||[]).concat(extraDbl||[]),year:r.year,month:r.month,startHome:r.home[0].slice(),prevLast:(r.prevLast||S.prevLast).slice(),
    prevStreak:(r.prevStreak||S.prevStreak).slice(),prevOff:(r.prevOff||S.prevOff||undefined),maxRun:MAXRUN,offP1:(r.offTarget||S.off)[0],offP2:(r.offTarget||S.off)[1],
    fixed,absence:r.absence||[],score:g});
}
let FIXES=[], FIX_HIDDEN=false, FIX_TOTAL=0;
function findFixes(){
  // Same-day fixes only — nothing before or after the short day is touched.
  const r=S.result, g=r.grid, D=g[0].length, score=scorer();
  const base=score(g), baseV=base.violations.length;
  const absAt=(i,d)=>(r.absence&&r.absence[i]&&r.absence[i][d])||0;
  const plainOff=(i,d)=>d<0?((r.prevLast||S.prevLast)[i]===0):d>=D?false:(g[i][d]===0||g[i][d]===8)&&!absAt(i,d);
  const gaps=[]; for(let d=0;d<D;d++) for(let s=1;s<=3;s++) if(cover(d,s)<2) gaps.push({d,s});
  const test=(ch,xd,xo,xds)=>{ const t=g.map(row=>row.slice()); ch.forEach(([a,dd,v])=>t[a][dd]=v); const sc=score(t,xd,xo,xds); return {v:sc.violations.length,cost:sc.cost}; };
  FIX_TOTAL=gaps.length;
  return gaps.slice(0,4).map(({d,s})=>{
    // Step 1: someone on 18:00–03:00 that day moves to the short shift
    const late=[];
    for(let a=0;a<g.length;a++) if(g[a][d]===4){ const ch=[[a,d,s]], t=test(ch);
      if(t.v<baseV) late.push({ch,...t,kind:'late',txt:`${nm(a)} moves from 18:00–03:00 to ${FULL[s]} on ${fmtD(d)}.`,tag:'No days off lost'}); }
    late.sort((x,y)=>x.v-y.v||x.cost-y.cost);
    if(late.length) return {d,s,step:1,top:late.slice(0,3)};
    // Step 2: someone with two days off in a row comes in on this one
    const inc=[];
    for(let a=0;a<g.length;a++) if(g[a][d]===0&&!absAt(a,d)&&(plainOff(a,d-1)||plainOff(a,d+1))){
      const ch=[[a,d,s]], t=test(ch,null,[a+':'+d]); if(t.v>=baseV) continue;
      const keep=plainOff(a,d-1)?d-1:d+1;
      inc.push({ch,...t,oc:a+':'+d,kind:'callin',txt:`${nm(a)} comes in on their day off (${fmtD(d)}) to work ${OC_FULL[s]}; keeps ${fmtD(keep)} off.`,tag:`${nm(a)} gives up 1 day off`}); }
    inc.sort((x,y)=>x.v-y.v||x.cost-y.cost);
    if(inc.length) return {d,s,step:2,top:inc.slice(0,3)};
    // Step 3: the supervisor covers the shift instead of his own that day
    const sp=r.sup||[];
    if(sp[d]===10&&supRestOK(sp[d-1],s)&&supRestOK(s,sp[d+1]))
      return {d,s,step:3,top:[{ch:[],sup:[d,s],kind:'sup',txt:`${SUP_ID} (supervisor) covers ${FULL[s]} on ${fmtD(d)} instead of his ${supHours(r.month).full} shift.`,tag:'Supervisor cover'}]};
    // Step 4: an agent already on the shift before works straight through — a double shift
    const dsOpts=[];
    { const prev=s===1?3:s-1, sd=s===1?d-1:d;
      if(sd>=0) for(let a=0;a<g.length;a++) if(g[a][sd]===prev&&!isDS(a,sd)&&!absAt(a,sd)){
        const t=test([],null,null,[a+':'+sd]);
        if(t.v<baseV) dsOpts.push({ch:[],ds:a+':'+sd,kind:'ds',...t,
          txt:`${nm(a)} works a double shift on ${fmtD(sd)} — ${DS_FULL[prev]} — covering ${LBL[s]}${s===1?` on ${fmtD(d)}`:''}.`,
          tag:'Double shift'}); } }
    dsOpts.sort((x,y)=>x.v-y.v||x.cost-y.cost);
    if(dsOpts.length) return {d,s,step:4,top:dsOpts.slice(0,3)};
    // Step 5 (very last): the supervisor comes in on his Sunday / Monday off
    if(sp[d]===0&&supOffDay(d)&&supRestOK(sp[d-1],s,d-1,d)&&supRestOK(s,sp[d+1],d,d+1))
      return {d,s,step:5,top:[{ch:[],sup:[d,s],supOc:true,kind:'sup',txt:`${SUP_ID} (supervisor) comes in on his day off (${fmtD(d)}) to cover ${OC_FULL[s]}.`,tag:'Supervisor, day off'}]};
    return {d,s,step:0,top:[]};
  });
}
let FORCE_LOCK=0;
function renderFixes(){
  const box=$('fixes'); const res=findFixes(); FIXES=[];
  rootEl.classList.toggle('has-fixes',!!res.length&&!FIX_HIDDEN);
  if(!res.length){ box.innerHTML=''; return; }
  if(FIX_HIDDEN){ box.innerHTML=`<div class="fx-head"><strong>${FIX_TOTAL} short shift${FIX_TOTAL>1?'s':''}</strong><button id="fxShow">Show fixes</button></div>`; return; }
  const shown=res.length, total=FIX_TOTAL;
  let h=`<div class="fx-head"><strong>Cover the short shift${total>shown?`s — showing ${shown} of ${total}`:''}</strong><button id="fxHide">Hide</button></div>`;
  res.forEach(({d,s,step,top})=>{
    h+=`<h3>${SNAME[s]} (${LBL[s]}) is short on ${fmtD(d)}</h3>`;
    if(step===1) h+=`<p class="note">Step 1 — move the agent on 18:00–03:00:</p>`;
    if(step===2) h+=`<p class="note">No one on 18:00–03:00 can take it. Step 2 — call in someone with two days off in a row:</p>`;
    if(step===3) h+=`<p class="note">No agent on 18:00–03:00 or with two days off in a row can cover. Step 3 — the supervisor fills in:</p>`;
    if(step===4) h+=`<p class="note">Step 4 — an agent on the shift before works a double shift:</p>`;
    if(step===5) h+=`<p class="note">No agent can cover, and ${SUP_ID} is off that day. Step 5 (very last option) — the supervisor comes in on his day off:</p>`;
    if(step===0) h+=`<p class="note">No one can cover ${fmtD(d)} — not even ${SUP_ID}, who is off or would break the 11-hour rest rule.</p>`;
    top.forEach(c=>{ const k=FIXES.push(c)-1;
      h+=`<div class="fix" data-fix="${k}"><p>${c.txt}</p><span class="tag${c.kind==='late'?' good':''}">${c.tag}</span><button data-apply="${k}">Apply</button></div>`; });
  });
  box.innerHTML=h;
}
const hint=(k,on)=>{ const c=FIXES[k]; if(!c) return;
  if(c.ds){ const [a,d]=c.ds.split(':').map(Number); const el=rootEl.querySelector(`.cell[data-i="${a}"][data-d="${d}"]`); el&&el.classList.toggle('hint',on); }
  c.ch.forEach(([a,d])=>{ const el=rootEl.querySelector(`.cell[data-i="${a}"][data-d="${d}"]`); el&&el.classList.toggle('hint',on); });
  if(c.sup){ const el=rootEl.querySelector(`.cell[data-sup][data-d="${c.sup[0]}"]`); el&&el.classList.toggle('hint',on); } };
$('fixes').addEventListener('mouseover',e=>{ const f=e.target.closest('[data-fix]'); rootEl.querySelectorAll('.cell.hint').forEach(x=>x.classList.remove('hint')); if(f) hint(+f.dataset.fix,true); });
$('fixes').addEventListener('mouseleave',()=>rootEl.querySelectorAll('.cell.hint').forEach(x=>x.classList.remove('hint')));
$('fixes').addEventListener('focusin',e=>{ const f=e.target.closest('[data-fix]'); rootEl.querySelectorAll('.cell.hint').forEach(x=>x.classList.remove('hint')); if(f) hint(+f.dataset.fix,true); });
$('fixes').addEventListener('click',e=>{
  if(BUSY) return;
  if(e.target.id==='fxHide'){ FIX_HIDDEN=true; renderFixes(); return; }
  if(e.target.id==='fxShow'){ FIX_HIDDEN=false; renderFixes(); return; }
  const b=e.target.closest('[data-apply]'); if(!b) return; const c=FIXES[+b.dataset.apply]; if(!c) return;
  snap('Apply fix'); c.ch.forEach(([a,d,v])=>{ S.result.grid[a][d]=v; pin(a,d); });
  if(c.oc){ S.result.oc=(S.result.oc||[]).concat([c.oc]); }
  if(c.ds){ S.result.ds=(S.result.ds||[]).concat([c.ds]); const [a,dd]=c.ds.split(':').map(Number); pin(a,dd); }
  if(c.sup){ S.result.sup[c.sup[0]]=c.sup[1]; if(c.supOc){ S.result.supOc=(S.result.supOc||[]).concat([c.sup[0]]); } } if(c.dbl){ S.result.dbl=(S.result.dbl||[]).concat([c.dbl]); } save(); renderGrids();
  $('msg').textContent='Fix applied.';
});
function cleanMarks(){ const r=S.result, g=r.grid; if(!g) return;
  const holds=(k,hi)=>{ const [i,d]=k.split(':').map(Number); return g[i]&&g[i][d]>=1&&g[i][d]<=hi; };
  if(r.oc) r.oc=r.oc.filter(k=>holds(k,4));
  if(r.dbl) r.dbl=r.dbl.filter(k=>holds(k,4));
  if(r.ds) r.ds=r.ds.filter(k=>holds(k,3)); }
function renderGrids(){
  cleanMarks();
  const r=S.result, D=r.grid[0].length, mn=MONTHS[r.month];
  $('h1title').textContent=`${mn} 1–15, ${r.year}`; $('h2title').textContent=`${mn} 16–${D}, ${r.year}`;
  renderGrid($('g1'),0,15,0); renderGrid($('g2'),15,D,1); renderChecks(); renderFixes(); pubUI();
}
// ---- holidays: click a date to toggle
on(document,'click',e=>{
  const b=e.target.closest('.dayh'); if(!b||BUSY) return;
  const d=+b.dataset.day, k=iso(S.result.year,S.result.month,d+1), on=S.holidays.includes(k);
  snap(on?`Remove holiday ${fmtD(d)}`:`Holiday ${fmtD(d)}`);
  S.holidays=on?S.holidays.filter(x=>x!==k):S.holidays.concat([k]); save(); renderGrids();
  $('msg').textContent=on?`${fmtD(d)} is no longer a holiday.`:`${fmtD(d)} marked as a holiday — every shift worked that day counts as a Double day.`;
  const nb=rootEl.querySelector(`.dayh[data-day="${d}"]`); nb&&nb.focus();
});
// ---- cell picker pop-up
const pop=$('picker'); let POP=null;
function closePop(focus){ if(!POP) return; pop.hidden=true; const c=POP; POP=null;
  if(focus){ const nb=rootEl.querySelector(`.cell[data-i="${c.i}"][data-d="${c.d}"]`); nb&&nb.focus(); } }
function openSupPop(btn){
  const d=+btn.dataset.d, v=S.result.sup[d]; POP={sup:true,d};
  const rest=(v===0), sh=supHours(S.result.month);
  const opts=[[10,sh.lab,'Supervisor shift · '+sh.full],[1,LBL[1],'Cover · '+(rest?OC_FULL[1]:'05:00–14:00')],[2,LBL[2],'Cover · '+(rest?OC_FULL[2]:'13:00–22:00')],[3,LBL[3],'Cover · '+(rest?OC_FULL[3]:'21:00–05:00')],[0,'OFF','Day off'],[6,'SICK','Sick day'],[5,'VAC','Vacation day']];
  pop.innerHTML=`<div class="pk-head">${SUP_ID} (supervisor) · ${new Date(S.result.year,S.result.month,d+1).toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'})}</div>`+
    opts.map(([code,lab,desc])=>`<button class="pk-opt${code===v?' cur':''}" data-code="${code}"><b class="s${code===10?'sup':code}">${lab}</b><span>${desc}</span>${code===v?'<em>current</em>':''}</button>`).join('');
  placePop(btn);
}
const PHONE=matchMedia('(max-width:640px)');
function placePop(btn){
  pop.insertAdjacentHTML('beforeend','<button class="pk-cancel" type="button">Cancel</button>');
  pop.hidden=false;
  // on a phone the options slide up from the bottom, full width, with large touch targets
  const sheet=PHONE.matches; pop.classList.toggle('sheet',sheet);
  if(sheet){ pop.style.left=''; pop.style.top=''; (pop.querySelector('.pk-opt.cur')||pop.querySelector('.pk-opt')).focus({preventScroll:true}); return; }
  // ASSET scrolls inside <main>, not the window, so the menu is fixed to the viewport (see builder.css)
  // and closes when the page scrolls under it.
  const rc=btn.getBoundingClientRect(), pw=pop.offsetWidth, ph=pop.offsetHeight;
  let left=rc.left, top=rc.bottom+6;
  left=Math.max(8,Math.min(left,document.documentElement.clientWidth-pw-8));
  if(rc.bottom+ph+6>window.innerHeight && rc.top-ph-6>0) top=rc.top-ph-6;
  pop.style.left=left+'px'; pop.style.top=top+'px'; POP_AT={btn,x:rc.left,y:rc.top};
  (pop.querySelector('.pk-opt.cur')||pop.querySelector('.pk-opt')).focus({preventScroll:true});
}
let POP_AT=null; // the cell the menu belongs to, and where it was on screen when the menu opened
on(document,'scroll',()=>{ if(!POP||!POP_AT||pop.classList.contains('sheet')) return;
  const rc=POP_AT.btn.getBoundingClientRect(); if(Math.abs(rc.left-POP_AT.x)>2||Math.abs(rc.top-POP_AT.y)>2) closePop(false); },true);
function openPop(btn){
  if(btn.dataset.sup){ openSupPop(btn); return; }
  const i=+btn.dataset.i,d=+btn.dataset.d, ab=(S.result.absence&&S.result.absence[i]&&S.result.absence[i][d])||0, v=S.result.grid[i][d];
  if(ab===7||(!ab&&v===7)){ $('msg').textContent='Training dates are changed in the absences list.'; return; }
  if(v===9){ $('msg').textContent=`${rName(i)} is not on the team on this day.`; return; }
  POP={i,d};
  const rest=(v===0||v===8); // picking a shift on a day off makes it an 8-hour call-in
  let opts=ab?[[ab,LBL[ab],TYPE[ab]],[0,'OFF','Day off (inside the '+TYPE[ab].toLowerCase()+')']]:optsFor(rest);
  if(!ab&&v>=1&&v<=3) opts=opts.concat([[isDS(i,d)?'-ds':'ds',`${LBL[v]} DS`,isDS(i,d)?'Back to a single shift':'Double shift · '+DS_FULL[v]]]);
  if(!ab&&v>=1&&v<=4&&isOC(i,d)) opts=opts.concat([[isD(i,d)?'-dbl':'dbl','DBL',isD(i,d)?'Not a Double day (normal call-in pay)':'Mark as Double day (paid double)']]);
  pop.innerHTML=`<div class="pk-head">${nm(i)} · ${new Date(S.result.year,S.result.month,d+1).toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'})}</div>`+
    opts.map(([code,lab,desc])=>`<button class="pk-opt${code===v?' cur':''}" data-code="${code}"><b class="s${typeof code==='string'?v:code}${code==='ds'?' ds':''}${code==='dbl'?' dblc':''}"${code==='dbl'?' style="background:var(--dblc);color:var(--dbl-ink)"':''}>${lab}</b><span>${desc}</span>${code===v?'<em>current</em>':''}</button>`).join('');
  placePop(btn);
}
on(document,'click',e=>{
  if(BUSY) return;
  if(e.target.closest('.pk-cancel')){ closePop(true); return; }
  const opt=e.target.closest('.pk-opt');
  if(opt&&POP&&!POP.sup&&(opt.dataset.code==='dbl'||opt.dataset.code==='-dbl')){
    const {i,d}=POP, on=opt.dataset.code==='dbl';
    snap(`${on?'Double day':'Not a Double day'} ${fmtD(d)}`);
    S.result.dbl=(S.result.dbl||[]).filter(k=>k!==i+':'+d); if(on) S.result.dbl.push(i+':'+d);
    save(); renderGrids(); closePop(true); return; }
  if(opt&&POP&&!POP.sup&&(opt.dataset.code==='ds'||opt.dataset.code==='-ds')){
    const {i,d}=POP, on=opt.dataset.code==='ds';
    snap(`${on?'Double shift':'Single shift'} ${fmtD(d)}`);
    S.result.ds=(S.result.ds||[]).filter(k=>k!==i+':'+d); if(on) S.result.ds.push(i+':'+d);
    pin(i,d); save(); renderGrids(); FIX_HIDDEN=false; renderFixes(); closePop(true); return; }
  if(opt&&POP&&POP.sup){ const d=POP.d, code=+opt.dataset.code;
    if(code!==S.result.sup[d]){ const was=S.result.sup[d]; snap(`Edit ${SUP_ID} ${fmtD(d)}`); S.result.sup[d]=code;
      S.result.supOc=S.result.supOc||[];
      if(was===0&&code>=1&&code<=4){ if(!S.result.supOc.includes(d)) S.result.supOc.push(d); } else S.result.supOc=S.result.supOc.filter(x=>x!==d); save(); renderGrids(); FIX_HIDDEN=false; renderFixes(); }
    pop.hidden=true; POP=null; const nb=rootEl.querySelector(`.cell[data-sup][data-d="${d}"]`); nb&&nb.focus(); return; }
  if(opt&&POP){ const {i,d}=POP, code=+opt.dataset.code;
    if(code!==S.result.grid[i][d]){ const was=S.result.grid[i][d]; snap(`Edit ${fmtD(d)}`); S.result.grid[i][d]=code; pin(i,d);
      if(S.result.ds) S.result.ds=S.result.ds.filter(k=>k!==i+':'+d);
      S.result.oc=S.result.oc||[];
      if((was===0||was===8)&&code>=1&&code<=4){ if(!S.result.oc.includes(i+':'+d)) S.result.oc.push(i+':'+d); }
      else if(!(code>=1&&code<=4)||was>=1&&was<=4) S.result.oc=S.result.oc.filter(k=>k!==i+':'+d); if(S.result.dbl) S.result.dbl=S.result.dbl.filter(k=>k!==i+':'+d); save(); renderGrids(); FIX_HIDDEN=false; renderFixes(); }
    closePop(true); return; }
  const b=e.target.closest('.cell');
  if(b){ if(POP&&POP.d===+b.dataset.d&&(b.dataset.sup?POP.sup:POP.i===+b.dataset.i)){ closePop(false); return; } closePop(false); openPop(b); return; }
  if(POP&&!e.target.closest('#picker')) closePop(false);
});
on(document,'keydown',e=>{
  if(!POP) return;
  if(e.key==='Escape'){ e.preventDefault(); closePop(true); }
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); const os=[...pop.querySelectorAll('.pk-opt')]; let k=os.indexOf(document.activeElement);
    k=(k+(e.key==='ArrowDown'?1:-1)+os.length)%os.length; os[k].focus(); }
});
// phones fire resize when the address bar slides away — only close when the width really changes
let LASTW=window.innerWidth; on(window,'resize',()=>{ if(window.innerWidth!==LASTW){ LASTW=window.innerWidth; closePop(false); } });

// ---- busy lock: nothing may change while a schedule is being built
const BUSY_IDS=['mon','yr','off1','off2','build','next','reset','undo','export','copyx','publish','unpublish','syncReload','hireAdd','abAdd','abA','abT','abF','abTo','lock','hireName','hireFrom'];
function setBusy(on){ BUSY=on; rootEl.dataset.busy=on?'1':'';
  BUSY_IDS.forEach(id=>{ const el=$(id); if(el) el.disabled=on; });
  rootEl.querySelectorAll('#agentRows input,#agentRows select,#agentRows button,#abList button,#abList input').forEach(el=>el.disabled=on);
  if(on) closePop(false); else undoUI(); }
// ---- build
let CANCEL=null;
$('cancelBuild').addEventListener('click',()=>{ if(CANCEL){ $('cancelBuild').disabled=true; $('msg').textContent='Cancelling…'; CANCEL(); } });
$('build').addEventListener('click',async()=>{
  if(BUSY) return;
  const preState=JSON.stringify(S);
  if(applyPending(iso(S.year,S.month,1))) { agentRows(); absUI(); renderPending(); }
  if(!rowCheck()) return;
  const btn=$('build'), r0=S.result;
  const same=r0.year===S.year&&r0.month===S.month&&(r0.ids||[]).join()===S.ids.join();
  // a schedule that is already out must not be replaced by accident
  if(same&&r0.built&&!btn.dataset.armed){
    btn.dataset.armed='1'; btn.textContent='Confirm rebuild'; btn.classList.add('danger');
    $('msg').textContent=`This replaces ${MONTHS[S.month]} ${S.year} on screen, including hand edits${S.lock?` after day ${S.lock}`:''}. Requested days off, sick, vacation, Double days and edited cells stay put. Click again to confirm.`;
    clearTimeout(btn._t); btn._t=setTimeout(()=>{ delete btn.dataset.armed; btn.textContent='Build schedule'; btn.classList.remove('danger'); },6000);
    return;
  }
  delete btn.dataset.armed; btn.textContent='Build schedule'; btn.classList.remove('danger'); clearTimeout(btn._t);
  // freeze everything this build depends on, so later clicks can't change it mid-run
  const cfg={year:S.year,month:S.month,off:S.off.slice(),ids:S.ids.slice(),names:S.names.slice(),rows:S.rows.slice(),
    prevLast:S.prevLast.slice(),prevStreak:S.prevStreak.slice(),prevOff:S.prevOff?S.prevOff.slice():undefined,
    supPrev:S.supPrev?Object.assign({},S.supPrev):null,
    prevEnd:S.prevEnd?S.prevEnd.slice():null, prevMustOff:S.prevMustOff?S.prevMustOff.slice():[], preCover:Object.assign({},S.preCover||{})};
  HIST.push({label:'Build schedule',state:preState}); if(HIST.length>50) HIST.shift();
  setBusy(true); $('prog').hidden=false; $('msg').textContent=`Building ${MONTHS[cfg.month]} ${cfg.year}… about 30 seconds.`;
  const bar=$('prog').firstElementChild;
  const absence=fixedFor(cfg.year,cfg.month,cfg.ids), D0=absence[0].length;
  const fixed=Array.from({length:cfg.ids.length},()=>Array(D0).fill(null));
  const lock=same?Math.min(Math.max(S.lock,FORCE_LOCK),D0):0; FORCE_LOCK=0;
  if(same){
    const g0=r0.grid, pins=new Set(r0.pins||[]);
    for(let i=0;i<cfg.ids.length;i++) for(let d=0;d<D0;d++){
      const v=g0[i][d];
      if(d<lock) fixed[i][d]=v;                                  // days already worked
      else if(v===8||v===9) fixed[i][d]=v;                       // requested days off / not on the team
      else if((v===5||v===6)&&!absence[i][d]) fixed[i][d]=v;     // single sick / vacation days
      else if(pins.has(i+':'+d)) fixed[i][d]=v;                  // hand edits and applied fixes
    }
  }
  const dblKeep=same?(r0.dbl||[]):[];
  dblKeep.forEach(k=>{ const [i,d]=k.split(':').map(Number); if(fixed[i]) fixed[i][d]=r0.grid[i][d]; });
  const ocKeep=same?(r0.oc||[]).filter(k=>{const [i,d]=k.split(':').map(Number); return fixed[i]&&fixed[i][d]!=null;}):[]; // call-in marks stay with their pinned cells
  const dsKeep=same?(r0.ds||[]).filter(k=>{const [i,d]=k.split(':').map(Number); return fixed[i]&&fixed[i][d]!=null;}):[];
  const mustWork=mustWorkFor(cfg.year,cfg.month,cfg.ids);
  const extras=cfg.rows.map((x,i)=>x<0?i:-1).filter(x=>x>=0);
  let res;
  try{
    const job=runBuild({...nextInfo(cfg.year,cfg.month,cfg.ids),prevEnd:cfg.prevEnd,prevMustOff:cfg.prevMustOff,preCover:cfg.preCover,
      supCover:(same&&r0.sup?r0.sup:[]).map(v=>v>=1&&v<=3?v:0),ds:dsKeep,oc:ocKeep,agents:cfg.ids.length,extras,mustWork,dbl:dblKeep,fixed,absence,year:cfg.year,month:cfg.month,
      startHome:cfg.rows.map(homeOfRow),prevLast:cfg.prevLast,prevStreak:cfg.prevStreak,prevOff:cfg.prevOff,
      maxRun:MAXRUN,offP1:cfg.off[0],offP2:cfg.off[1],seed:(Math.random()*1e9)|0,restarts:6,iters:400000},
      p=>{bar.style.width=(p*100).toFixed(1)+'%'; $('msg').textContent=`Building ${MONTHS[cfg.month]} ${cfg.year}… ${Math.round(p*100)}%`;});
    CANCEL=job.cancel; $('cancelBuild').hidden=false; $('cancelBuild').disabled=false;
    res=await job.promise;
  }catch(err){
    CANCEL=null; $('cancelBuild').hidden=true; setBusy(false); $('prog').hidden=true; bar.style.width='0';
    // put everything back exactly as it was before Build was clicked (including team changes that were due)
    HIST.pop(); S=JSON.parse(preState); N=S.names.length; save();
    syncControls(); agentRows(); absUI(); renderPending(); $('lock').value=S.lock||0; renderGrids(); undoUI();
    $('msg').textContent=err&&err.message==='cancelled'?'Build cancelled — nothing was changed.':'The build failed — nothing was changed.'; return; }
  CANCEL=null; $('cancelBuild').hidden=true;
  const supKeep=same&&r0.sup?r0.sup.slice():supDefault(cfg.year,cfg.month,cfg.supPrev);
  S.result={built:true,prevEnd:cfg.prevEnd,prevMustOff:cfg.prevMustOff,preCover:cfg.preCover,ds:dsKeep,oc:ocKeep,supOc:same&&r0.supOc?r0.supOc.slice():[],pins:same?(r0.pins||[]).slice():[],sup:supKeep,supPrev:cfg.supPrev,names:cfg.names,ids:cfg.ids,
    grid:res.grid,home:res.home,rows:[cfg.rows.slice(),cfg.rows.map(up)],absence,mustWork,dbl:dblKeep.slice(),
    year:cfg.year,month:cfg.month,offTarget:res.offTarget,targets:res.targets,
    prevLast:cfg.prevLast,prevStreak:cfg.prevStreak,prevOff:cfg.prevOff||null};
  setBusy(false); $('prog').hidden=true; bar.style.width='0';
  save(); renderGrids();
  $('msg').textContent=res.violations.length?'Built — some rules could not be met; see the list below.':`Built ${MONTHS[cfg.month]} ${cfg.year}.`;
});
$('next').addEventListener('click',()=>{
  snap('Set up next month');
  const r=S.result, D=r.grid[0].length;
  S.rows=r.rows[1].map(up);
  // always move forward: whatever line an agent lands on, it takes the shift after the one they just worked
  const nextOf=h=>h>=1&&h<=3?(h%3)+1:h;
  S.rows.forEach((row,i)=>{ if(row>=0&&r.home[1][i]>=1&&r.home[1][i]<=3) S.rowShift[row]=nextOf(r.home[1][i]); });
  S.prevLast=r.grid.map(row=>row[D-1]);
  // when each agent's last shift really ended (call-ins end earlier, double shifts later) and who must rest on the 1st
  const OCE={1:13,2:21,3:29,4:27}, DSE={1:22,2:29,3:38};
  S.prevEnd=r.grid.map((row,i)=>{ const v=row[D-1]; if(!E.SH[v]) return null; const k=i+':'+(D-1);
    return (r.ds||[]).includes(k)&&DSE[v]?DSE[v]:(r.oc||[]).includes(k)?(OCE[v]??E.SH[v][1]):E.SH[v][1]; });
  S.prevMustOff=r.grid.map((row,i)=>(r.ds||[]).includes(i+':'+(D-1))?1:0);
  S.preCover={1:r.grid.filter((row,i)=>row[D-1]===3&&(r.ds||[]).includes(i+':'+(D-1))).length};
  S.prevStreak=r.grid.map(row=>{let k=0;for(let d=D-1;d>=0&&WORK(row[d]);d--)k++;return k;});
  S.prevOff=r.grid.map(row=>{let k=0;for(let d=D-1;d>=0&&row[d]===0;d--)k++;return k;}); S.lock=0; $('lock').value=0;
  { const lastSup=(r.sup||[])[D-1]??0, hh=lastSup===11?supAlt(r.month):supHours(r.month); S.supPrev={last:lastSup===11?10:lastSup,h:hh.h,lab:hh.lab}; }
  S.month=(r.month+1)%12; S.year=r.year+(r.month===11?1:0);
  const nD=dim(S.year,S.month); S.off=[defOff(15),defOff(nD-15)];
  const chg=applyPending(iso(S.year,S.month,1));
  save(); syncControls(); agentRows(); absUI(); renderPending();
  if(chg){ $('msg').textContent=`Ready for ${MONTHS[S.month]} ${S.year} — team changes applied (${chg}). Press Build schedule.`; return; }
  $('msg').textContent=`Ready for ${MONTHS[S.month]} ${S.year} — press Build schedule.`;
});

// ---- export
// ---- copy for Excel (works everywhere, including shared links where file downloads are blocked)
function scheduleHtml(){
  const r=S.result, g=r.grid, D=g[0].length, Y=r.year, M=r.month;
  const FILLC=['#E7E6E6','#BDD7EE','#C6E0B4','#F4C7D0','#F8CBAD','#D9D2E9','#FFE699','#A6E3E9','#DFD2F2','#FFFFFF'];
  const DSFC={1:'#2E75B6',2:'#4E8B2B',3:'#B8436A'}, CALLINC='#FFD54A', DBLCC='#E08A1E';
  const td='border:1px solid #BFBFBF;text-align:center;font-family:Arial;font-size:9pt;padding:2px 4px;';
  const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  let html='', text='';
  [[0,15,0],[15,D,1]].forEach(([d0,d1,p])=>{
    const rows=r.rows[p], homes=r.home[p];
    const title=`Team Schedule — ${MONTHS[M]} ${d0+1}–${d1}, ${Y}`;
    html+=`<table style="border-collapse:collapse"><tr><td colspan="${d1-d0+2}" style="font-family:Arial;font-size:14pt;font-weight:bold">${title}</td></tr><tr><td style="${td}font-weight:bold">Agent</td><td style="${td}font-weight:bold">Shift</td>`;
    text+=title+'\n'+['Agent','Shift'].join('\t');
    for(let d=d0;d<d1;d++){ const dt=new Date(Y,M,d+1), sun=dt.getDay()===0, hol=S.holidays.includes(iso(Y,M,d+1));
      const lab=`${dt.toLocaleDateString('en-US',{weekday:'short'})} ${d+1}${hol?' HOL':''}`;
      html+=`<td style="${td}font-weight:bold;${hol?'background:#F6D365;':sun?'background:#FDE9D9;color:#C00000;':''}">${lab}</td>`; text+='\t'+lab; }
    html+='</tr>'; text+='\n';
    orderOf(rows).forEach(i=>{ const row=g[i]; const who=rName(i);
      html+=`<tr><td style="${td}text-align:left;font-weight:bold">${esc(who)}</td><td style="${td}text-align:left;color:#595959">${esc(SNAME[homes[i]]||'')}</td>`;
      text+=who+'\t'+(SNAME[homes[i]]||'');
      for(let d=d0;d<d1;d++){ const v=row[d], dd=(r.dbl||[]).includes(i+':'+d)||(HOLAT(d)&&v>=1&&v<=4), ocx=isOC(i,d), dsx=isDS(i,d);
        const lab=cellLab(v,ocx,dsx)+(dd?' DBL':'');
        const bgc=dsx&&DSFC[v]?DSFC[v]:dd&&v>=1&&v<=4?DBLCC:ocx&&v>=1&&v<=3?CALLINC:FILLC[v];
        const fg=dsx&&DSFC[v]?'color:#fff;font-weight:bold;':dd||ocx?'font-weight:bold;':(v===0||v>=5?'font-weight:bold;':'');
        html+=`<td style="${td}background:${bgc};${fg}">${lab}</td>`; text+='\t'+lab; }
      html+='</tr>'; text+='\n'; });
    { const sp=r.sup||[]; html+=`<tr><td colspan="${d1-d0+2}" style="font-family:Arial;font-size:9pt;font-weight:bold;color:#595959;padding-top:6px">Supervisor</td></tr><tr><td style="${td}text-align:left;font-weight:bold">${SUP_ID}</td><td style="${td}text-align:left;color:#595959">Supervisor</td>`;
      text+=`Supervisor\n${SUP_ID}\tSupervisor`;
      for(let d=d0;d<d1;d++){ const v=sp[d]??0, lab=supLab(v,d)+(v>=1&&v<=4?' (cover)':'')+(HOLAT(d)&&(v>=1&&v<=4||v===10||v===11)?' DBL':'');
        html+=`<td style="${td}background:${v===10?'#FFFFFF':FILLC[v]};${v>=1&&v<=4?'border:2px solid #0B6E78;font-weight:bold;':''}">${lab}</td>`; text+='\t'+lab; }
      html+='</tr>'; text+='\n'; }
    html+='</table><br>'; text+='\n';
  });
  return {html,text};
}
async function copySchedule(){
  const {html,text}=scheduleHtml();
  try{ await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]); return true; }catch(e){}
  const div=document.createElement('div'); div.contentEditable='true'; div.style.cssText='position:fixed;left:-9999px;top:0;background:#fff;color:#000';
  div.innerHTML=html; document.body.appendChild(div);
  const range=document.createRange(); range.selectNodeContents(div); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(range);
  let ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
  sel.removeAllRanges(); div.remove(); return ok;
}
$('copyx').addEventListener('click',async()=>{
  const ok=await copySchedule();
  $('msg').textContent=ok?'Schedule copied with its colours — open Excel, click cell A1 and paste (Ctrl+V).':'Copying was blocked in this view. Ask the owner of the page to download the Excel file.';
});
async function exportXlsx(){
  const fallback=async why=>{ const ok=await copySchedule();
    $('msg').textContent=ok?`${why} The schedule was copied instead — open Excel, click cell A1 and paste (Ctrl+V).`:`${why} Use “Copy for Excel” or ask the page owner for the file.`; };
  let XLSX; try{ XLSX=(await import('xlsx-js-style')).default; }catch(e){ await fallback('The Excel library could not load here.'); return; }
  if(DEAD) return;
  const r=S.result, g=r.grid, D=g[0].length, Y=r.year, M=r.month;
  const FILL=['E7E6E6','BDD7EE','C6E0B4','F4C7D0','F8CBAD','D9D2E9','FFE699','A6E3E9','DFD2F2','FFFFFF'];
  const DSF={1:'2E75B6',2:'4E8B2B',3:'B8436A'}, CALLIN='FFD54A', DBLC='E08A1E';
  const fillOf=(v,oc,dsx,dd)=>dsx&&DSF[v]?DSF[v]:dd&&v>=1&&v<=4?DBLC:oc&&v>=1&&v<=3?CALLIN:FILL[v];
  const inkOf=(v,oc,dsx,dd)=>dsx&&DSF[v]?'FFFFFF':dd?'2E1B00':oc?'3A2C00':undefined;
  const bd={style:'thin',color:{rgb:'BFBFBF'}}; const border={top:bd,bottom:bd,left:bd,right:bd};
  const font=(o={})=>Object.assign({name:'Arial',sz:10},o);
  const wb=XLSX.utils.book_new(), ws={};
  const put=(rr,cc,v,st)=>{ws[XLSX.utils.encode_cell({r:rr,c:cc})]={v,t:typeof v==='number'?'n':'s',s:st};};
  let R=0, maxC=1;
  put(R,0,`Team Schedule — ${MONTHS[M]} ${Y}`,{font:font({bold:true,sz:14})}); R+=2;
  // both halves on one sheet, stacked
  [[0,15,0],[15,D,1]].forEach(([d0,d1,p])=>{
    const homes=r.home[p], rows=r.rows[p], nd=d1-d0, sp=r.sup||[];
    maxC=Math.max(maxC,1+nd);
    put(R,0,`${MONTHS[M]} ${d0+1}–${d1}`,{font:font({bold:true,sz:11})});
    put(R+1,0,'DAY',{font:font({bold:true})}); put(R+2,0,'DATE',{font:font({bold:true})});
    for(let j=0;j<nd;j++){ const dt=new Date(Y,M,d0+j+1), sun=dt.getDay()===0, hol=S.holidays.includes(iso(Y,M,d0+j+1));
      const st={font:font({bold:true,color:{rgb:sun?'C00000':'000000'}}),alignment:{horizontal:'center'},border,
        fill:hol?{fgColor:{rgb:'F6D365'}}:sun?{fgColor:{rgb:'FDE9D9'}}:undefined};
      put(R+1,1+j,dt.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()+(hol?' · HOL':''),st);
      put(R+2,1+j,`${d0+j+1}-${MONTHS[M].slice(0,3)}`,st); }
    let rr=R+3;
    orderOf(rows).forEach(i=>{ const row=g[i];
      put(rr,0,rName(i),{font:font({bold:true})});
      for(let j=0;j<nd;j++){ const v=row[d0+j], dd=(r.dbl||[]).includes(i+':'+(d0+j))||(HOLAT(d0+j)&&v>=1&&v<=4);
        const ocx=isOC(i,d0+j), dsx=isDS(i,d0+j), ink=inkOf(v,ocx,dsx,dd);
        put(rr,1+j,cellLab(v,ocx,dsx)+(dd?' DBL':''),{font:font({bold:!v||v>=5||dd||dsx,sz:9,color:ink?{rgb:ink}:undefined}),
          alignment:{horizontal:'center'}, border, fill:{fgColor:{rgb:fillOf(v,ocx,dsx,dd)}}}); }
      rr++; });
    rr++; // blank row, then the supervisor
    put(rr,0,SUP_ID,{font:font({bold:true})});
    for(let j=0;j<nd;j++){ const v=sp[d0+j]??0, cov=v>=1&&v<=4;
      put(rr,1+j,supLab(v,d0+j)+(cov?' (cover)':'')+(HOLAT(d0+j)&&(cov||v===10||v===11)?' DBL':''),{font:font({bold:cov||!v,sz:9}),alignment:{horizontal:'center'},
        border:cov?{top:{style:'medium',color:{rgb:'0B6E78'}},bottom:{style:'medium',color:{rgb:'0B6E78'}},left:{style:'medium',color:{rgb:'0B6E78'}},right:{style:'medium',color:{rgb:'0B6E78'}}}:border,
        fill:{fgColor:{rgb:v===10?'FFFFFF':FILL[v]}}}); }
    R=rr+3;
  });
  put(R,0,'05:00 Morning (to 14:00) · 13:00 Afternoon (to 22:00) · 21:00 Night (to 05:00) · 18:00 Late swing (to 03:00) · "-off" called in on a day off (8 h) · OFF day off · VAC vacation · SICK sick leave · TRN cross-training · X OFF extra day off requested · DBL Double day · HOL holiday',{font:font({italic:true,color:{rgb:'595959'},sz:9})});
  ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:R+1,c:maxC}});
  ws['!cols']=[{wch:14},...Array(maxC).fill({wch:9})];
  ws['!freeze']={xSplit:1};
  const mn=MONTHS[M].slice(0,3);
  XLSX.utils.book_append_sheet(wb,ws,`${mn} ${Y}`);
  const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});
  try{ await saveFile(`Team_Schedule_${mn}_${Y}.xlsx`,new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})); $('msg').textContent='Excel file saved.'; }
  catch(err){ await fallback('The file could not be saved in this view.'); }
}
// a normal browser download (the page can override it through mount options)
function saveFile(filename,blob){
  if(download) return download(filename,blob);
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export').addEventListener('click',exportXlsx);
$('reset').addEventListener('click',()=>{
  const btn=$('reset');
  if(!btn.dataset.armed){ // two-step confirm (pop-up dialogs are blocked inside the artifact viewer)
    btn.dataset.armed='1'; btn.textContent='Click again to reset'; btn.classList.add('danger');
    $('msg').textContent='This clears the team, absences and the schedule in the shared workspace, for every editor. Published schedules are not affected.';
    clearTimeout(btn._t); btn._t=setTimeout(()=>{ delete btn.dataset.armed; btn.textContent='Reset'; btn.classList.remove('danger'); },5000);
    return;
  }
  delete btn.dataset.armed; btn.textContent='Reset'; btn.classList.remove('danger'); clearTimeout(btn._t);
  snap('Reset');
  S=fresh(); N=S.names.length; save(); syncControls(); agentRows(); absUI(); renderPending(); $('lock').value=0; renderGrids();
  $('msg').textContent='Reset — back to the October 2026 starting schedule. Undo brings your work back.';
});

$('undo').addEventListener('click',()=>{
  if($('build').disabled) return; // not while a build is running
  const h=HIST.pop(); if(!h) return;
  S=JSON.parse(h.state); N=S.names.length; save();
  syncControls(); agentRows(); absUI(); renderPending(); $('lock').value=S.lock||0; renderGrids(); undoUI();
  $('msg').textContent=`Undone: ${h.label}.`;
});
on(document,'keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)){ e.preventDefault(); $('undo').click(); }
});
// ---- reload the shared workspace (after a save conflict, or when the server was unreachable)
$('syncReload').addEventListener('click',async()=>{
  if(BUSY||!storage) return; const btn=$('syncReload'); btn.disabled=true;
  try{ const w=await storage.load(); if(DEAD) return;
    VERSION=w?w.version:null; CONFLICT=false; REMOTE_OK=true; DIRTY=false; clearTimeout(SAVE_T); SAVE_T=null; LOAD_NOTE='';
    adopt(w&&w.state); HIST.length=0; writeDraft();
    syncControls(); agentRows(); absUI(); renderPending(); $('lock').value=S.lock||0; renderGrids(); undoUI(); syncUI('saved');
    $('msg').textContent=LOAD_NOTE||'Reloaded — this is the latest saved version.'; }
  catch(e){ if(!DEAD) $('msg').textContent='Could not reload — check the connection and try again.'; }
  finally{ btn.disabled=false; }
});
// ---- publish: agents see the month on screen, read-only (cell codes only — no absence reasons,
// pending hires, history or builder settings; see publishShape.js)
const PUBLISHED=new Set(); // 'year-month(1-12)'
const pubKey=()=>`${S.result.year}-${S.result.month+1}`;
function pubUI(){
  const b=$('publish'), u=$('unpublish'); if(!b) return;
  const has=PUBLISHED.has(pubKey());
  b.hidden=!publish; if(!b.dataset.armed) b.textContent=has?'Republish':'Publish';
  u.hidden=!(canUnpublish&&unpublish&&has);
}
function disarm(b,label){ delete b.dataset.armed; b.classList.remove('danger'); clearTimeout(b._t); if(label) b.textContent=label; }
function arm(b,label,rest,msg){ b.dataset.armed='1'; b.textContent=label; b.classList.add('danger'); $('msg').textContent=msg;
  clearTimeout(b._t); b._t=setTimeout(()=>{ disarm(b,rest); pubUI(); },6000); }
$('publish').addEventListener('click',async()=>{
  if(BUSY||!publish) return; const b=$('publish'), r=S.result, Y=r.year, M=r.month, label=`${MONTHS[M]} ${Y}`;
  const has=PUBLISHED.has(pubKey());
  if(has&&!b.dataset.armed){ arm(b,'Confirm republish','Republish',`${label} is already published. Republishing replaces what agents see now with the schedule on screen. Click again to confirm.`); return; }
  disarm(b); b.disabled=true; $('msg').textContent=`Publishing ${label}…`;
  try{ await publish(Y,M+1,toPublished(S)); if(DEAD) return; PUBLISHED.add(`${Y}-${M+1}`); $('msg').textContent=`Published — agents can see ${label} now.`; }
  catch(e){ if(!DEAD) $('msg').textContent=`Publishing failed — ${e&&e.message||'please try again'}.`; }
  finally{ b.disabled=BUSY; pubUI(); }
});
$('unpublish').addEventListener('click',async()=>{
  if(BUSY||!unpublish) return; const b=$('unpublish'), r=S.result, Y=r.year, M=r.month, label=`${MONTHS[M]} ${Y}`;
  if(!b.dataset.armed){ arm(b,'Click again to unpublish','Unpublish',`This takes ${label} down — agents will no longer see it. Click again to confirm.`); return; }
  disarm(b,'Unpublish'); b.disabled=true; $('msg').textContent=`Unpublishing ${label}…`;
  try{ await unpublish(Y,M+1); if(DEAD) return; PUBLISHED.delete(`${Y}-${M+1}`); $('msg').textContent=`${label} is no longer published.`; }
  catch(e){ if(!DEAD) $('msg').textContent=`Unpublishing failed — ${e&&e.message||'please try again'}.`; }
  finally{ b.disabled=BUSY; pubUI(); }
});
if(listPublished) listPublished().then(rows=>{ if(DEAD) return; (rows||[]).forEach(x=>PUBLISHED.add(`${x.year}-${x.month}`)); pubUI(); },()=>{});

syncControls(); agentRows(); absUI(); renderPending(); $('lock').value=S.lock; renderGrids(); undoUI();
syncUI(REMOTE_OK?'saved':'offline');
if(LOAD_NOTE) $('msg').textContent=LOAD_NOTE;

return function unmount(){
  DEAD=true;
  JOBS.forEach(j=>j.cancel()); JOBS.clear();
  LISTENERS.forEach(([t,type,fn,o])=>t.removeEventListener(type,fn,o)); LISTENERS.length=0;
  clearTimeout(SAVE_T); SAVE_T=null;
  if(DIRTY&&!SAVING) flushSave(); // don't drop the last edit when leaving the page
};
}
