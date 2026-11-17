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
const fmtWhen = (t) => new Date(t).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const dayLab = (y, m1, day) => new Date(y, m1 - 1, day).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })

// Team Schedule Builder — Director + Supervisor only (route guard in App.jsx; RLS enforces it too).
// The builder itself is the reference page's script (features/schedule/builderApp.js), mounted
// into this container; React loads the shared workspace first and hands it over.
// Above it: a "Viewing" picker for every built month (read-only; only the month in the builder can be
// edited) and, for the Director, the change audit — every cell changed since a month's original build.
export default function ScheduleBuilder() {
  const { profile } = useAuth()
  const rootRef = useRef(null)
  const [initial, setInitial] = useState(null) // { state, version } | { error }
  const isDirector = profile?.role === 'director'

  const [months, setMonths] = useState([])     // archive rows, newest first
  const [working, setWorking] = useState(null)  // { year, m1, built } — the month in the builder
  const [sel, setSel] = useState(WORK)
  const [compare, setCompare] = useState(false) // Director: highlight changes since the original build
  const [view, setView] = useState(null)        // { key, P } | { key, error }
  const [audit, setAudit] = useState(null)      // { key, changes, who, original } | { key, error }
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
  const showGrid = readOnly || (isDirector && compare)
  const [selY, selM] = selKey ? selKey.split('-').map(Number) : [null, null]

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

  // Director: the change log and original build of the selected month
  useEffect(() => {
    if (!isDirector || !selKey) return
    let alive = true
    Promise.all([listChanges(selY, selM), getOriginal(selY, selM)]).then(async ([changes, original]) => {
      const who = await editorIds([...(changes || []).map((c) => c.changed_by), original?.built_by]).catch(() => ({}))
      if (alive) setAudit({ key: selKey, changes: changes || [], who, original })
    }, () => { if (alive) setAudit({ key: selKey, error: true }) })
    return () => { alive = false }
  }, [isDirector, selKey, selY, selM, tick])

  const P = view && view.key === selKey ? view.P : null
  const A = audit && audit.key === selKey ? audit : null
  const changed = useMemo(() => {
    if (!isDirector || !compare || !P || !A?.original || !valid(A.original.data)) return null
    const diff = diffMaps(cellMap(A.original.data), cellMap(P.d))
    return new Map(diff.map((c) => [`${c.id}:${c.day - 1}`, c.from]))
  }, [isDirector, compare, P, A])

  const options = useMemo(() => {
    const list = months.map((m) => keyOf(m.year, m.month))
    if (workKey && !list.includes(workKey)) list.unshift(workKey)
    return list
  }, [months, workKey])
  const label = (k) => { const [y, m] = k.split('-').map(Number); return `${MONTHS[m - 1]} ${y}` }

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
                  <label className="chk">
                    <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                    Highlight changes since the original build
                  </label>
                )}
                <p className="note" style={{ margin: 0, flex: '1 1 260px' }}>
                  {readOnly
                    ? `Read-only. Only ${workKey ? label(workKey) : 'the month in the builder'} can be edited.`
                    : showGrid ? 'Showing the last saved copy with changed cells outlined. Untick to edit.' : 'Every built month is kept here for viewing.'}
                </p>
              </div>
            </section>

            {isDirector && selKey && <ChangesPanel A={A} y={selY} m1={selM} />}

            {showGrid && (
              view?.key === selKey && view.error
                ? <section className="panel"><p className="empty">{label(selKey)} hasn't been saved to the archive yet.</p></section>
                : !P
                  ? <section className="panel"><p className="note">Loading…</p></section>
                  : (
                    <>
                      <section className="panel half">
                        <h2>{MONTHS[P.d.month]} 1–15, {P.d.year}</h2>
                        <Grid P={P} d0={0} d1={Math.min(15, P.d.days)} p={0} changed={changed} />
                      </section>
                      <section className="panel half">
                        <h2>{MONTHS[P.d.month]} 16–{P.d.days}, {P.d.year}</h2>
                        <Grid P={P} d0={15} d1={P.d.days} p={1} changed={changed} />
                      </section>
                    </>
                  )
            )}
          </div>
        </div>
      )}

      <div ref={rootRef} className="schedule-builder" hidden={!initial || showGrid} />
    </Layout>
  )
}

// Director only: every save that changed cells after the month's original build.
function ChangesPanel({ A, y, m1 }) {
  const [open, setOpen] = useState(false)
  if (!A) return <section className="panel changes"><h2>Changes since the original build</h2><p className="note">Loading…</p></section>
  if (A.error) return <section className="panel changes"><h2>Changes since the original build</h2><p className="note">Could not load the change log.</p></section>
  const cells = A.changes.reduce((n, c) => n + (c.cells?.length || 0), 0)
  const by = (id) => A.who[id] || 'Unknown'
  return (
    <section className="panel changes">
      <div className="row">
        <h2>Changes since the original build</h2>
        {A.changes.length > 0 && <button className="linkbtn" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show'} details</button>}
      </div>
      <p className="note" style={{ margin: 0 }}>
        {A.original ? `Original build ${fmtWhen(A.original.built_at)}${A.original.built_by ? ` by ${by(A.original.built_by)}` : ''}. ` : 'No original build on record yet. '}
        {A.changes.length
          ? `${cells} cell change${cells === 1 ? "" : "s"} in ${A.changes.length} save${A.changes.length === 1 ? '' : 's'}.`
          : 'No changes since then.'}
      </p>
      {open && (
        <ol className="chglist">
          {A.changes.map((c) => (
            <li key={c.id}>
              <div className="chgh">
                <b>{by(c.changed_by)}</b>
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
