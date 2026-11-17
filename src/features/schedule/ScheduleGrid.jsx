// Read-only schedule grid in the published shape (surveillance_schedules.data / the builder's month
// archive). Shared by the agents' Schedule page and the builder's month viewer. IDs only, never names.
// `changed` (optional): Map of 'ID:day0' -> hover text, to outline cells (e.g. changed since the first draft).
import { LBL, SNAME, SUP_ID, supHours, supAlt, cellLab, iso } from './scheduleShared'

export function valid(d) {
  return d && d.schemaVersion === 1 && Array.isArray(d.grid) && Array.isArray(d.ids)
    && Array.isArray(d.order) && Array.isArray(d.home) && d.grid.every((r) => Array.isArray(r) && r.length === d.days)
}

// Everything the view needs to know about one published month, precomputed.
export function prepare(d) {
  const oc = new Set(d.oc || []), ds = new Set(d.ds || []), dbl = new Set(d.dbl || [])
  const hol = new Set(d.holidays || [])
  const supRow = d.sup?.row || []
  const supOc = new Set(d.sup?.oc || [])
  const isHol = (day) => hol.has(iso(d.year, d.month, day + 1))
  return { d, oc, ds, dbl, isHol, supRow, supOc, supId: d.sup?.id || SUP_ID }
}

export const supLab = (P, v, day) => v === 11 ? supAlt(P.d.month).lab : v === 10 ? supHours(P.d.month).lab
  : LBL[v] + (P.supOc.has(day) && v >= 1 && v <= 4 ? '-off' : '')

export function Grid({ P, d0, d1, p, myRow = null, changed = null }) {
  const { d } = P
  const supWas = (day) => (changed ? changed.get(`${P.supId}:${day}`) : undefined)
  const order = (d.order[p] || []).filter((i) => d.grid[i] && d.grid[i].slice(d0, d1).some((v) => v !== 9))
  const days = []
  for (let day = d0; day < d1; day++) days.push(day)
  return (
    <div className="scroll">
      <table className="grid">
        <thead>
          <tr>
            <th className="name">Agent</th>
            {days.map((day) => {
              const dt = new Date(d.year, d.month, day + 1)
              const sun = dt.getDay() === 0
              const hol = P.isHol(day)
              return (
                <th key={day} className={`${sun ? 'sun' : ''}${hol ? ' hol' : ''}`}>
                  <span className="dayh">
                    {dt.toLocaleDateString('en-US', { weekday: 'short' })}<br />{day + 1}{hol && <i>HOL</i>}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {order.map((i) => {
            const home = d.home[p]?.[i]
            return (
              <tr key={i} className={myRow === i ? 'me' : undefined} aria-current={myRow === i ? 'true' : undefined}>
                <th className="name">
                  {d.ids[i]}{myRow === i && <span className="you">You</span>}
                  <small>{SNAME[home] || ''}</small>
                </th>
                {days.map((day) => {
                  const v = d.grid[i][day]
                  const k = `${i}:${day}`
                  const isOc = P.oc.has(k)
                  const isDs = P.ds.has(k) && v >= 1 && v <= 3
                  const isD = P.dbl.has(k)
                  const cls = `cell s${v}${isOc && v >= 1 && v <= 3 ? ' oc' : ''}${isD && v >= 1 && v <= 4 ? ' dblc' : ''}${isDs ? ' ds' : ''}`
                  const was = changed && changed.get(`${d.ids[i]}:${day}`)
                  return (
                    <td key={day} className={P.isHol(day) ? 'holc' : undefined}>
                      <span className={`${cls}${was != null ? ' chg' : ''}`} title={was != null ? was : undefined}>
                        {cellLab(v, isOc, isDs)}{isD && <i className="dblb">DBL</i>}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
          <tr className="supsep"><th className="name" colSpan={d1 - d0 + 1}>Supervisor</th></tr>
          <tr className={myRow === 'sup' ? 'me' : undefined}>
            <th className="name">
              {P.supId}{myRow === 'sup' && <span className="you">You</span>}
              <small>Supervisor · {supHours(d.month).full}</small>
            </th>
            {days.map((day) => {
              const v = P.supRow[day] ?? 0
              const cov = v >= 1 && v <= 4
              const cls = `cell s${v === 10 || v === 11 ? 'sup' : v}${cov ? ' supcov' : ''}${P.supOc.has(day) && v >= 1 && v <= 3 ? ' oc' : ''}`
              return (
                <td key={day} className={P.isHol(day) ? 'holc' : undefined}>
                  <span className={`${cls}${supWas(day) != null ? ' chg' : ''}`} title={supWas(day) != null ? supWas(day) : undefined}>{supLab(P, v, day)}</span>
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

