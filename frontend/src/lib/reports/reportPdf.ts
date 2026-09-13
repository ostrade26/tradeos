import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { BuiltReport } from './builders'
import { formatDate } from '../utils'

export function downloadReportPdf(title: string, built: BuiltReport, subtitle?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(title, 14, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(subtitle || `Generated ${formatDate(new Date().toISOString().slice(0, 10))} · Audit support only`, 14, 20)
  doc.setTextColor(0)
  autoTable(doc, {
    startY: 24,
    head: [built.columns.map(c => c.header)],
    body: built.rows.map(row => built.columns.map(c => String(row[c.key] ?? ''))),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [49, 58, 70] },
  })
  doc.save(`${title.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}
