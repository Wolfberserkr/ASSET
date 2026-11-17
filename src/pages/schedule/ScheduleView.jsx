import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PencilRuler } from 'lucide-react'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { listPublished, getPublished } from '../../features/schedule/scheduleApi'
import { Grid, valid, prepare, supLab } from '../../features/schedule/ScheduleGrid'
import {
  MONTHS, LBL, FULL, OC_FULL, DS_FULL,
  supHours, supAlt, cellLab, normId,
} from '../../features/schedule/scheduleShared'
import '../../features/schedule/fonts'
import '../../features/schedule/builder.css'
import '../../features/schedule/view.css'

// Published team schedule — read-only, for every active surveillance account (agent, supervisor,
// director). IDs only: rows are labelled with employee IDs from the published data, never names.

const keyOf = (y, m1) => `${y}-${m1}` // m1 = 1-12, as in surveillance_schedules.month
const SHIFT_NAME = { 1: 'Morning', 2: 'Afternoon', 3: 'Night', 4: 'Late swing', 7: 'Cross-training' }

// One worked day for the signed-in user, or null when it isn't a working day.
function shiftOn(P, row, day) {
  const { d } = P
  const date = new Date(d.year, d.month, day + 1)
  if (row === 'sup') {
    const v = P.supRow[day] ?? 0
    if (v === 10 || v === 11) {
      const h = v === 10 ? supHours(d.month) : supAlt(d.month)
      return { date, lab: h.lab, name: 'Supervisor shift', time: h.full, dbl: P.isHol(day), cls: 'ssup' }
    }
    if (v >= 1 && v <= 4) {
      const oc = P.supOc.has(day)
      return {
        date, lab: supLab(P, v, day), name: `Covering ${SHIFT_NAME[v].toLowerCase()}`,
        time: oc ? OC_FULL[v] : FULL[v], callIn: oc, dbl: P.isHol(day), cls: `s${v} supcov${oc && v <= 3 ? ' oc' : ''}`,
      }
    }
    return null
  }
  const v = d.grid[row][day]
  const k = `${row}:${day}`
  if (v === 7) return { date, lab: LBL[7], name: SHIFT_NAME[7], time: FULL[7], cls: 's7' }
  if (!(v >= 1 && v <= 4)) return null
  const isDs = P.ds.has(k) && v <= 3
  const isOc = P.oc.has(k)
  const isDbl = P.dbl.has(k) || P.isHol(day)
  return {
    date,
    lab: cellLab(v, isOc, isDs),
    name: isDs ? `Double shift (${SHIFT_NAME[v].toLowerCase()})` : isOc ? `Called in (${SHIFT_NAME[v].toLowerCase()})` : SHIFT_NAME[v],
    time: isDs ? DS_FULL[v] : isOc ? OC_FULL[v] : FULL[v],
    callIn: isOc, dbl: isDbl,
    cls: `s${v}${isOc && v <= 3 ? ' oc' : ''}${P.dbl.has(k) ? ' dblc' : ''}${isDs ? ' ds' : ''}`,
  }
}

function rowOf(P, myId) {
  if (!myId) return null
  const i = P.d.ids.findIndex((id) => normId(id) === myId)
  if (i >= 0) return i
  if (normId(P.supId) === myId) return 'sup'
  return null
}

export default function ScheduleView() {
  const { profile } = useAuth()
  const isEditor = profile?.role === 'director' || profile?.role === 'supervisor'
  const myId = profile?.employee_id ? normId(profile.employee_id) : null

  const [list, setList] = useState(null)   // [{ year, month, ... }] newest first
  const [sel, setSel] = useState(null)     // 'year-month(1-12)'
  const [months, setMonths] = useState({}) // key -> prepared month | null (not published)
  const [error, setError] = useState('')

  const now = new Date()
  const curKey = keyOf(now.getFullYear(), now.getMonth() + 1)
  const nextKey = keyOf(now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), ((now.getMonth() + 1) % 12) + 1)

  useEffect(() => {
    listPublished().then(
      (rows) => {
        const l = rows || []
        setList(l)
        const keys = l.map((r) => keyOf(r.year, r.month))
        setSel(keys.includes(curKey) ? curKey : (keys[0] ?? null))
      },
      () => { setList([]); setError('Could not load the published schedules. Check the connection and try again.') },
    )
  }, [curKey])

  // load the selected month, plus this month and next (for "My next shifts")
  useEffect(() => {
    if (!list) return
    const published = new Set(list.map((r) => keyOf(r.year, r.month)))
    const want = [sel, curKey, nextKey].filter((k) => k && published.has(k) && !(k in months))
    if (!want.length) return
    let alive = true
    Promise.all(want.map((k) => {
      const [y, m] = k.split('-').map(Number)
      return getPublished(y, m).then((row) => [k, row && valid(row.data) ? prepare(row.data) : null], () => [k, null])
    })).then((pairs) => {
      if (alive) setMonths((prev) => ({ ...prev, ...Object.fromEntries(pairs) }))
    })
    return () => { alive = false }
  }, [list, sel, curKey, nextKey, months])

  const P = sel ? months[sel] : undefined

  const nextShifts = useMemo(() => {
    const out = []
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let onSchedule = false
    for (let k = 0; k < 62 && out.length < 7; k++) {
      const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + k)
      const M = months[keyOf(dt.getFullYear(), dt.getMonth() + 1)]
      if (!M) continue
      const row = rowOf(M, myId)
      if (row == null) continue
      onSchedule = true
      const s = shiftOn(M, row, dt.getDate() - 1)
      if (s) out.push(s)
    }
    return { out, onSchedule }
  }, [months, myId]) // eslint-disable-line react-hooks/exhaustive-deps

  const myRow = P ? rowOf(P, myId) : null
  const nothingPublished = list && list.length === 0

  return (
    <Layout wide>
      <div className="schedule-builder schedule-view">
        <div className="wrap">
          <header>
            <h1>Team Schedule</h1>
            <p>The published surveillance schedule, by agent ID. Your own row is highlighted.</p>
            {isEditor && (
              <p className="toplinks">
                <Link to="/schedule/builder" className="linkbtn"><PencilRuler size={14} style={{ verticalAlign: '-2px' }} /> Open the schedule builder</Link>
              </p>
            )}
          </header>

          {error && <p className="note errnote">{error}</p>}
          {!list && <p className="note">Loading…</p>}
          {nothingPublished && !error && (
            <section className="panel"><p className="empty">No schedule has been published yet.</p></section>
          )}

          {list && list.length > 0 && (
            <section className="panel pick">
              <div className="controls">
                <div className="field">
                  <label htmlFor="schedMonth">Month</label>
                  <select id="schedMonth" value={sel ?? ''} onChange={(e) => setSel(e.target.value)}>
                    {list.map((r) => (
                      <option key={keyOf(r.year, r.month)} value={keyOf(r.year, r.month)}>
                        {MONTHS[r.month - 1]} {r.year}
                      </option>
                    ))}
                  </select>
                </div>
                {P && (
                  <p className="note" style={{ margin: 0 }}>
                    {myId && myRow == null ? `Your ID (${myId}) is not on this schedule.` : ''}
                  </p>
                )}
              </div>
            </section>
          )}

          {list && list.length > 0 && (
            <section className="panel mynext" aria-labelledby="mynextTitle">
              <h2 id="mynextTitle">My next shifts</h2>
              {!nextShifts.onSchedule
                ? <p className="empty">You are not on a published schedule for this month or next.</p>
                : !nextShifts.out.length
                  ? <p className="empty">No shifts in the published schedule from today.</p>
                  : (
                    <ol className="nextlist">
                      {nextShifts.out.map((s) => (
                        <li key={s.date.toISOString()}>
                          <span className="nd">
                            <b>{s.date.toLocaleDateString('en-US', { weekday: 'short' })}</b>
                            {s.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className={`cell ${s.cls}`}>{s.lab}</span>
                          <span className="nt">
                            <b>{s.time}</b>
                            <small>
                              {s.name}
                              {s.callIn ? ' · 8-hour call-in' : ''}
                              {s.dbl ? ' · Double day' : ''}
                            </small>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
            </section>
          )}

          {sel && P === null && (
            <section className="panel"><p className="empty">This month could not be loaded.</p></section>
          )}
          {P && (
            <>
              <section className="panel half">
                <h2>{MONTHS[P.d.month]} 1–15, {P.d.year}</h2>
                <Grid P={P} d0={0} d1={Math.min(15, P.d.days)} p={0} myRow={myRow} />
              </section>
              <section className="panel half">
                <h2>{MONTHS[P.d.month]} 16–{P.d.days}, {P.d.year}</h2>
                <Grid P={P} d0={15} d1={P.d.days} p={1} myRow={myRow} />
              </section>
              <section className="panel legendp">
                <h2>Legend</h2>
                <div className="legend">
                  <span><b className="s1">05:00</b>Morning 05:00–14:00</span>
                  <span><b className="s2">13:00</b>Afternoon 13:00–22:00</span>
                  <span><b className="s3">21:00</b>Night 21:00–05:00</span>
                  <span><b className="s4">18:00</b>Late swing 18:00–03:00</span>
                  <span><b className="s1 ds">05:00 DS</b>Double shift — straight through two shifts (05:00–22:00, 13:00–05:00, 21:00–14:00)</span>
                  <span><b className="oc">05:00-off</b>Called in on a day off — an 8-hour shift</span>
                  <span><b style={{ background: 'var(--dblc)', color: 'var(--dbl-ink)' }}>DBL</b>Double day</span>
                  <span><b className="s0">OFF</b>Day off</span>
                  <span><b className="s8">X OFF</b>Extra day off</span>
                  <span><b className="s5">VAC</b>Vacation</span>
                  <span><b className="s6">SICK</b>Sick leave</span>
                  <span><b className="s7">TRN</b>Cross-training 09:00–18:00</span>
                  <span><b className="ssup">{supHours(P.d.month).lab}</b>Supervisor ({P.supId}) · {supHours(P.d.month).full}; outlined when covering an agent shift</span>
                  <span><b style={{ background: 'var(--hol)', color: 'var(--hol-ink)' }}>HOL</b>Holiday — every shift worked counts as a Double day</span>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
