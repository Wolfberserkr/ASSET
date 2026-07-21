// Supabase caps every query at 1000 rows server-side (and several pages used
// to pass smaller .limit() values). As the question pool grows, a single
// capped query silently drops rows. This helper pages through .range() until
// a short page comes back, so callers always get the complete result set.
//
// `buildQuery` must return a FRESH query builder on every call (builders are
// single-use once executed).
const PAGE_SIZE = 1000

export async function fetchAllRows(buildQuery) {
  let from = 0
  let all  = []
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < PAGE_SIZE) return all
    from += PAGE_SIZE
  }
}
