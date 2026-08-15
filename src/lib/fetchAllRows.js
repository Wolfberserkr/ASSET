// Supabase caps every query at 1000 rows server-side (and several pages used
// to pass smaller .limit() values). As the question pool grows, a single
// capped query silently drops rows. This helper pages through .range() until
// a short page comes back, so callers always get the complete result set.
//
// `buildQuery` must return a FRESH query builder on every call (builders are
// single-use once executed).
//
// `maxPages` caps how far it will page. Omitted, it reads everything. Pass a
// cap where an unbounded result would be a UI problem rather than a data
// problem — the Audit Log uses it so one enormous month can't lock the page
// up, and surfaces a banner when the cap is hit (see `truncated` below).
const PAGE_SIZE = 1000

export async function fetchAllRows(buildQuery, { maxPages = Infinity } = {}) {
  let from = 0
  let all  = []
  let pages = 0
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all = all.concat(data ?? [])
    pages++
    if (!data || data.length < PAGE_SIZE) return all
    if (pages >= maxPages) {
      // Signal the cap without changing the array type callers expect.
      all.truncated = true
      return all
    }
    from += PAGE_SIZE
  }
}
