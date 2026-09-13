import * as XLSX from 'xlsx'
import { downloadFile, exportToCSV } from '../export'
import type { BuiltReport } from './builders'
import { AUDIT_PACK_REPORTS, getReport, type ReportId } from './catalog'

export function exportReportExcel(reportTitle: string, built: BuiltReport, filename: string) {
  const header = built.columns.map(c => c.header)
  const body = built.rows.map(row => built.columns.map(c => row[c.key] ?? ''))
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, reportTitle.slice(0, 31))
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  downloadFile(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`)
}

export function exportReportCsv(built: BuiltReport, filename: string) {
  exportToCSV(
    built.rows as Record<string, unknown>[],
    built.columns.map(c => ({ key: c.key as keyof Record<string, unknown>, header: c.header })),
    filename,
  )
}

export function exportAuditSupportPack(reports: { id: ReportId; built: BuiltReport }[], filename: string) {
  const wb = XLSX.utils.book_new()
  const cover = [
    ['TradeOS Audit Support Pack'],
    ['This pack supports internal review. It is not a statutory audit report.'],
    ['Generated', new Date().toISOString()],
    [],
    ['Included reports'],
    ...reports.map(r => [getReport(r.id)?.title ?? r.id]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cover), 'Cover')
  for (const { id, built } of reports) {
    const title = (getReport(id)?.title ?? id).slice(0, 31)
    const header = built.columns.map(c => c.header)
    const body = built.rows.map(row => built.columns.map(c => row[c.key] ?? ''))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...body]), title)
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  downloadFile(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`)
}

export { AUDIT_PACK_REPORTS }
