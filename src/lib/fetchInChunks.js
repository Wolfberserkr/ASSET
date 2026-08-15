import { fetchAllRows } from './fetchAllRows'

// Fetch rows where `column IN ids`, split into chunks so we never blow past
// PostgREST's .in() list / URL-length limits (which silently truncate).
// `buildQuery(chunk)` must return a supabase query for one chunk of ids.
//
// Two caps are in play and they are easy to confuse:
//
//   1. The .in() list length / URL size — what the chunking below is for.
//   2. The 1000-row response cap that PostgREST applies to EVERY query —
//      what fetchAllRows is for.
//
// This helper used to handle only (1), with a chunk size of 200. One session
// carries ~10 answers, so a 200-session chunk asked for ~2000 rows and
// silently got 1000 — roughly half of every chunk was dropped, and Weak Areas
// percentages were computed on a truncated sample.
//
// Each chunk is now paged through fetchAllRows rather than shrinking the chunk
// size to fit under 1000. Shrinking would work today but leaves the
// correctness of this helper depending on sessions staying at 10 questions
// each; paging cannot drift.
const IN_CHUNK_SIZE = 200

export async function fetchInChunks(ids, buildQuery) {
  const out = []
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + IN_CHUNK_SIZE)
    out.push(...await fetchAllRows(() => buildQuery(chunk)))
  }
  return out
}
