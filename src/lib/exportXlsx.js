// ============================================================
// Shared Excel export helper.
//
// Wraps the dynamic-import SheetJS pattern that every management
// page rolls by hand (TeamDashboard, AuditLog, WeakAreas, …) so
// new pages don't repeat it. `xlsx` is imported lazily here too,
// so it stays code-split and only downloads when someone exports.
//
//   await exportXlsx({
//     filename: 'stellaris_scorecard',   // date + .xlsx appended
//     sheets: [
//       { name: 'Scorecard', rows: [...], cols: [{ wch: 14 }, ...] },
//       { name: 'By Game',   rows: [...] },
//     ],
//   })
//
// `rows` is an array of flat objects (keys become column headers).
// A single-sheet export can pass { sheet, rows, cols } instead of
// the `sheets` array.
// ============================================================

export async function exportXlsx({ filename, sheets, sheet, rows, cols }) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const list = sheets ?? [{ name: sheet ?? 'Sheet1', rows: rows ?? [], cols }]
  for (const s of list) {
    const ws = XLSX.utils.json_to_sheet(s.rows ?? [])
    if (s.cols) ws['!cols'] = s.cols
    // Sheet names are capped at 31 chars by the format.
    XLSX.utils.book_append_sheet(wb, ws, (s.name ?? 'Sheet1').slice(0, 31))
  }

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${filename}_${today}.xlsx`)
}

// A period-stamp sheet, so a workbook always records what it covers rather
// than relying on whoever opens it remembering.
//
// Note the two dates do different jobs: the trailing date exportXlsx appends
// to every filename is "generated on", while `period` is the reporting window.
// A month-scoped export carries both — completion_tracker_2026-03_2026-08-15.xlsx
// is March's data, pulled in August.
//
//   sheets: [ ...,
//     summarySheet('March 2026', { 'Agent filter': 'All', Note: '…' }) ]
export function summarySheet(period, extra = {}) {
  return {
    name: 'Summary',
    rows: [{ Period: period, Generated: new Date().toLocaleString(), ...extra }],
    cols: [{ wch: 26 }, { wch: 22 }],
  }
}
