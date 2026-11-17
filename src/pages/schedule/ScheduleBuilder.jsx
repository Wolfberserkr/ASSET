import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { mount } from '../../features/schedule/builderApp'
import template from '../../features/schedule/builderTemplate'
import {
  loadWorkspace, saveWorkspace, publishSchedule, unpublishSchedule, listPublished, getPublished,
  listMonths, getMonth, saveMonth, logChanges, listChanges, getOriginal, editorIds,
} from '../../features/schedule/scheduleApi'
import { Grid, valid, prepare } from '../../features/schedule/ScheduleGrid'
import { cellMap, diffMaps } from '../../features/schedule/scheduleDiff'
import { MONTHS } from '../../features/schedule/scheduleShared'
import '../../features/schedule/fonts'
import '../../features/schedule/builder.css'
import '../../features/schedule/view.css'

const keyOf = (y, m1) => `${y}-${m1}` // m1 = 1-12
const WORK = 'work'
const ROLE = { director: 'Director', supervisor: 'Supervisor' }
const fmtWhen = (t) => new Date(t).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const dayLab = (y, m1, day) => new Date(y, m1 - 1, day).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })

// what the Director is looking at for a month
const SHOW = {
  edit: 'Current schedule',
  changes: 'Current — changed cells outlined',
  draft: 'First draft (as built)',
}

// Team Schedule Builder — Director + Supervisor only (route guard in App.jsx; RLS enforces it too).
// The builder itself is the reference page's script (features/schedule/builderApp.js), mounted
// into this container; React loads the shared workspace first and hands it over.
// Above it: a "Viewing" picker for every built month (read-only; only the month in the builder can be
// edited) and, for the Director, the month's first draft and every change made since, by whom.
export default function ScheduleBuilder() {
  const { profile } = useAuth()
  const rootRef = useRef(null)
  const [initial, setInitial] = useState(null) // { state, version } | { error }
  const isDirector = profile?.role === 'director'

  const [months, setMonths] = useState([])     // archive rows, newest first
  const [working, setWorking] = useState(null)  // { year, m1, built } — the month in the builder
  const [sel, setSel] = useState(WORK)
  const [show, setShow] = useState('edit')      // Director: edit | changes | draft
  const [who, setWho] = useState('all')         // Director: whose changes to outline (user uuid)
  const [view, setView] = useState(null)        // { key, P } | { key, error }
  const [audit, setAudit] = useState(null)      // { key, changes, people, original } | { key, error }
  const [tick, setTick] = useState(0)           // bumps when the builder archives a new copy

  useEffect(() => {
    let alive = true
    loadWorkspace().then(
      (w) => { if (alive) setInitial({ state: w?.state ?? null, version: w?.version ?? null }) },
      (error) => { if (alive) setInitial({ error }) },
    )
    return () => { alive = false }
  }, [])

  const refreshMonths = useCallback(() => {
    listMonths().then((rows) => setMonths(rows || []), () => {})
  }, [])
  useEffect(() => { refreshMonths() }, [refreshMonths])

  const onWorkingMonth = useCallback((year, month0, built) => {
    setWorking((w) => (w && w.year === year && w.m1 === month0 + 1 && w.built === built ? w : { year, m1: month0 + 1, built }))
  }, [])
  const onArchived = useCallback(() => { refreshMonths(); setTick((t) => t + 1) }, [refreshMonths])

  useEffect(() => {
    const el = rootRef.current
    if (!initial || !el) return
    el.innerHTML = template
    const unmount = mount(el, {
      initial,
      storage: { load: loadWorkspace, save: saveWorkspace },
      publish: publishSchedule,
      unpublish: unpublishSchedule,
      listPublished,
      getPublished,
      canUnpublish: isDirector,
      archive: saveMonth,
      logChanges,
      onWorkingMonth,
      onArchived,
    })
    return () => { unmount(); el.innerHTML = '' }
  }, [initial, isDirector, onWorkingMonth, onArchived])

  const workKey = working ? keyOf(working.year, working.m1) : null
  const selKey = sel === WORK ? workKey : sel
  const readOnly = sel !== WORK && sel !== workKey
  const mode = isDirector ? (readOnly && show === 'edit' ? 'current' : show) : (readOnly ? 'current' : 'edit')
  const showGrid = mode !== 'edit'
  const [selY, selM] = selKey ? selKey.split('-').map(Number) : [null, null]

  // switching month starts from the plain view and everyone's changes
  useEffect(() => { setShow('edit'); setWho('all') }, [selKey])

  // the archived copy of the selected month (for viewing, or for comparing the working month)
  useEffect(() => {
    if (!showGrid || !selKey) return
    let alive = true
    getMonth(selY, selM).then(
      (row) => { if (alive) setView(row && valid(row.data) ? { key: selKey, P: prepare(row.data) } : { key: selKey, error: true }) },
      () => { if (alive) setView({ key: selKey, error: true }) },
    )
    return () => { alive = false }
  }, [showGrid, selKey, selY, selM, tick])

  // Director: the month's first draft and change log
  useEffect(() => {
    if (!isDirector || !selKey) return
    let alive = true
    Promise.all([listChanges(selY, selM), getOriginal(selY, selM)]).then(async ([changes, original]) => {
      const people = await editorIds([...(changes || []).map((c) => c.changed_by), original?.built_by]).catch(() => ({}))
      if (alive) setAudit({ key: selKey, changes: changes || [], people, original })
    }, () => { if (alive) setAudit({ key: selKey, error: true }) })
    return () => { alive = false }
  }, [isDirector, selKey, selY, selM, tick])

  const P = view && view.key === selKey ? view.P : null
  const A = audit && audit.key === selKey && !audit.error ? audit : null
  const O = A?.original && valid(A.original.data) ? prepare(A.original.data) : null
  const tag = useCallback((uid) => {
    const p = A?.people?.[uid]
    return p ? `${ROLE[p.role] || p.role} ${p.badge}` : 'Unknown'
  }, [A])

  // outlined cells + hover text, keyed 'ID:day0'
  const outline = useMemo(() => {
    if (!isDirector || (mode !== 'changes' && mode !== 'draft') || !P || !A) return null
    const m = new Map()
    if (who === 'all') {
      if (!O) return null
      diffMaps(cellMap(O.d), cellMap(P.d)).forEach((c) => {
        m.set(`${c.id}:${c.day - 1}`, mode === 'draft' ? `Now ${c.to} (first draft ${c.from})` : `First draft ${c.from} → now ${c.to}`)
      })
      return m
    }
    // one person's edits: first "from" and last "to" for each cell they touched (log is newest first)
    const span = new Map()
    A.changes.filter((c) => c.changed_by === who).slice().reverse().forEach((c) => (c.cells || []).forEach((x) => {
      const k = `${x.id}:${x.day - 1}`
      const s = span.get(k)
      span.set(k, { from: s ? s.from : x.from, to: x.to })
    }))
    span.forEach((s, k) => m.set(k, `${tag(who)} changed ${s.from} → ${s.to}`))
    return m
  }, [isDirector, mode, P, A, O, who, tag])

  const options = useMemo(() => {
    const list = months.map((m) => keyOf(m.year, m.month))
    if (workKey && !list.includes(workKey)) list.unshift(workKey)
    return list
  }, [months, workKey])
  const label = (k) => { const [y, m] = k.split('-').map(Number); return `${MONTHS[m - 1]} ${y}` }

  const gridP = mode === 'draft' ? O : P
  const note = mode === 'edit'
    ? 'Every built month is kept here for viewing.'
    : mode === 'draft'
      ? 'The schedule exactly as first built. Outlined cells were changed afterwards — hover to see what they are now.'
      : mode === 'changes'
        ? `Showing the last saved copy. Outlined cells were changed${who === 'all' ? ' since the first draft' : ` by ${tag(who)}`} — hover for details.${readOnly ? '' : ' Choose "Current schedule" to edit.'}`
        : `Read-only. Only ${workKey ? label(workKey) : 'the month in the builder'} can be edited.`

  return (
    <Layout wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/schedule"
          className="inline-flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--color-brand-cyan)' }}
        >
          <CalendarDays size={15} /> Published schedule
        </Link>
      </div>
      {!initial && (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-brand-cyan)' }}
          />
        </div>
      )}

      {initial && (
        <div className="schedule-builder schedule-view months-bar">
          <div className="wrap">
            <section className="panel">
              <div className="controls">
                <div className="field">
                  <label htmlFor="viewMonth">Viewing</label>
                  <select id="viewMonth" value={sel === WORK ? WORK : sel} onChange={(e) => setSel(e.target.value)}>
                    {workKey && <option value={WORK}>{label(workKey)} — in the builder</option>}
                    {options.filter((k) => k !== workKey).map((k) => <option key={k} value={k}>{label(k)}</option>)}
                  </select>
                </div>
                {isDirector && selKey && (
                  <div className="field">
                    <label htmlFor="viewShow">Show</label>
                    <select id="viewShow" value={show} onChange={(e) => setShow(e.target.value)}>
                      {Object.entries(SHOW).map(([k, t]) => (
                        <option key={k} value={k} disabled={k === 'draft' && !O}>{k === 'edit' && readOnly ? 'Final schedule' : t}</option>
                      ))}
                    </select>
                  </div>
                )}
                {isDirector && selKey && (mode === 'changes' || mode === 'draft') && A && A.changes.length > 0 && (
                  <div className="field">
                    <label htmlFor="viewWho">Changes by</label>
                    <select id="viewWho" value={who} onChange={(e) => setWho(e.target.value)}>
                      <option value="all">Everyone (vs first draft)</option>
                      {[...new Set(A.changes.map((c) => c.changed_by))].map((u) => <option key={u} value={u}>{tag(u)}</option>)}
                    </select>
                  </div>
                )}
                <p className="note" style={{ margin: 0, flex: '1 1 260px' }}>{note}</p>
              </div>
            </section>

            {isDirector && selKey && <ChangesPanel audit={audit && audit.key === selKey ? audit : null} tag={tag} y={selY} m1={selM} />}

            {showGrid && (
              mode === 'draft'
                ? (!A ? <section className="panel"><p className="note">Loading…</p></section>
                  : !O ? <section className="panel"><p className="empty">No first draft on record for {label(selKey)}.</p></section> : null)
                : view?.key === selKey && view.error
                  ? <section className="panel"><p className="empty">{label(selKey)} hasn't been saved to the archive yet.</p></section>
                  : !P ? <section className="panel"><p className="note">Loading…</p></section> : null
            )}
            {showGrid && gridP && (mode !== 'draft' || P) && (
              <>
                <section className="panel half">
                  <h2>{mode === 'draft' ? 'First draft · ' : ''}{MONTHS[gridP.d.month]} 1–15, {gridP.d.year}</h2>
                  <Grid P={gridP} d0={0} d1={Math.min(15, gridP.d.days)} p={0} changed={outline} />
                </section>
                <section className="panel half">
                  <h2>{mode === 'draft' ? 'First draft · ' : ''}{MONTHS[gridP.d.month]} 16–{gridP.d.days}, {gridP.d.year}</h2>
                  <Grid P={gridP} d0={15} d1={gridP.d.days} p={1} changed={outline} />
                </section>
              </>
            )}
          </div>
        </div>
      )}

      <div ref={rootRef} className="schedule-builder" hidden={!initial || showGrid} />
    </Layout>
  )
}

const SOURCE = {
  build: (when, by) => `First draft: built ${when}${by ? ` by ${by}` : ''}.`,
  published: (when, by) => `First draft: the copy published ${when}${by ? ` by ${by}` : ''} — this month was built before change tracking began, so edits made before publishing aren't known.`,
  tracking_start: (when) => `First draft not on record — change tracking began ${when}, after this month was built. The snapshot from that moment is used as the starting point; changes before it aren't known.`,
}

// Director only: the month's first draft, and every save that changed cells since — by whom.
function ChangesPanel({ audit, tag, y, m1 }) {
  const [open, setOpen] = useState(true)
  const title = <h2>First draft &amp; changes</h2>
  if (!audit) return <section className="panel changes">{title}<p className="note">Loading…</p></section>
  if (audit.error) return <section className="panel changes">{title}<p className="note">Could not load the change log.</p></section>
  const { changes, original } = audit
  const people = [...new Set(changes.map((c) => c.changed_by))].map((u) => {
    const mine = changes.filter((c) => c.changed_by === u)
    return { u, saves: mine.length, cells: mine.reduce((n, c) => n + (c.cells?.length || 0), 0), last: mine[0]?.changed_at }
  })
  const src = SOURCE[original?.source] || SOURCE.build
  return (
    <section className="panel changes">
      <div className="row">
        {title}
        {changes.length > 0 && <button className="linkbtn" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show'} details</button>}
      </div>
      <p className="note" style={{ margin: 0 }}>
        {original ? src(fmtWhen(original.built_at), original.built_by ? tag(original.built_by) : '') : 'No first draft on record yet.'}
      </p>
      {changes.length === 0
        ? <p className="note" style={{ margin: '6px 0 0' }}>No changes since then.</p>
        : (
          <ul className="chgwho">
            {people.map((p) => (
              <li key={p.u}>
                <b>{tag(p.u)}</b> changed {p.cells} cell{p.cells === 1 ? '' : 's'} in {p.saves} save{p.saves === 1 ? '' : 's'}
                <span> · last {fmtWhen(p.last)}</span>
              </li>
            ))}
          </ul>
        )}
      {open && changes.length > 0 && (
        <ol className="chglist">
          {changes.map((c) => (
            <li key={c.id}>
              <div className="chgh">
                <b>{tag(c.changed_by)}</b>
                <span>{fmtWhen(c.changed_at)}</span>
                <span className={`tag${c.after_publish ? ' pub' : ''}`}>{c.after_publish ? 'After publishing' : 'Before publishing'}</span>
                {c.kind === 'rebuild' && <span className="tag">Rebuild</span>}
              </div>
              <ul>
                {(c.cells || []).map((x) => (
                  <li key={`${x.id}:${x.day}`}>
                    <b>{x.id}</b> · {dayLab(y, m1, x.day)} · <s>{x.from}</s> → <b>{x.to}</b>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
