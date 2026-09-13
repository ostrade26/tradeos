export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; header: string }[],
  filename: string
) {
  const headers = columns.map(c => c.header)
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key]
      const str = val == null ? '' : String(val)
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`)
}

export function filterByDateRange<T extends { date: string }>(
  items: T[],
  range: 'month' | 'year' | 'all'
): T[] {
  if (range === 'all') return items
  const now = new Date()
  const cutoff = new Date()
  if (range === 'month') cutoff.setMonth(now.getMonth() - 1)
  else cutoff.setFullYear(now.getFullYear() - 1)
  return items.filter(item => new Date(item.date) >= cutoff)
}
