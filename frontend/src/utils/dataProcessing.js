/**
 * Data Processing Utilities
 * Helpers for grouping and calculating statistics by TESTNR
 */

export function groupByTestnr(usterTbl = [], tensorapidTbl = []) {
  // Merge rows by TESTNR into a map { testnr: { uster: [...], tensorapid: [...] } }
  const map = new Map()

  for (const r of usterTbl || []) {
    const t = String(r.TESTNR || '')
    if (!t) continue
    if (!map.has(t)) map.set(t, { uster: [], tensorapid: [] })
    map.get(t).uster.push(r)
  }

  for (const r of tensorapidTbl || []) {
    const t = String(r.TESTNR || '')
    if (!t) continue
    if (!map.has(t)) map.set(t, { uster: [], tensorapid: [] })
    map.get(t).tensorapid.push(r)
  }

  return map // Map of testnr -> { uster: [], tensorapid: [] }
}

export function extractNumericValues(map, variable) {
  // variable can be like 'TITULO' (from uster) or 'FUERZA_B' (from tensorapid)
  const rows = []
  for (const [testnr, group] of map.entries()) {
    const values = []
    // prefer USTER_TBL fields
    if (group.uster && group.uster.length > 0) {
      for (const r of group.uster) {
        const v = r[variable]
        const n = Number(String(v).replace(',', '.'))
        if (!Number.isFinite(n)) continue
        values.push(n)
      }
    }
    // include tensorapid values as well (if variable exists there)
    if (group.tensorapid && group.tensorapid.length > 0) {
      for (const r of group.tensorapid) {
        const v = r[variable]
        const n = Number(String(v).replace(',', '.'))
        if (!Number.isFinite(n)) continue
        values.push(n)
      }
    }
    rows.push({ testnr, values })
  }
  return rows
}

export function computeStatsPerTest(rows) {
  // rows: [{ testnr, values: [num...] }]
  const out = rows.map((r) => {
    const vals = r.values || []
    const n = vals.length
    const mean = n ? vals.reduce((s, v) => s + v, 0) / n : null
    const variance =
      n && mean != null ? vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n : null
    const sd = variance != null ? Math.sqrt(variance) : null
    const ucl = mean != null && sd != null ? mean + 3 * sd : null
    const lcl = mean != null && sd != null ? mean - 3 * sd : null
    const outOfControl = []
    if (n && mean != null && sd != null) {
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i]
        if (v > ucl || v < lcl) outOfControl.push(i)
      }
    }
    return {
      testnr: r.testnr,
      count: n,
      mean: mean == null ? null : Number(mean.toFixed(4)),
      sd: sd == null ? null : Number(sd.toFixed(4)),
      ucl: ucl == null ? null : Number(ucl.toFixed(4)),
      lcl: lcl == null ? null : Number(lcl.toFixed(4)),
      values: vals,
      outOfControl
    }
  })
  // Sort by testnr (lexicographic ok if padded)
  out.sort((a, b) => String(a.testnr).localeCompare(String(b.testnr)))
  return out
}

export default {
  groupByTestnr,
  extractNumericValues,
  computeStatsPerTest
}
