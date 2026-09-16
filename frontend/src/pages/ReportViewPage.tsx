import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { DataTable } from '../components/ui/DataTable'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Drawer'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { ReportFiltersBar } from '../components/reports/ReportFiltersBar'
import { ColumnPicker, loadVisibleColumns, uniqueSorted } from '../components/reports/ColumnPicker'
import { useTradeStore } from '../store/TradeStore'
import { getReport } from '../lib/reports/catalog'
import { applyReportFilters, emptyReportFilters } from '../lib/reports/filters'
import { buildReport, type ReportRow } from '../lib/reports/builders'
import { exportReportCsv, exportReportExcel } from '../lib/reports/exportWorkbook'
import { downloadReportPdf } from '../lib/reports/reportPdf'
import { saveExceptionOverlay, type ExceptionStatus } from '../lib/reports/exceptionOverlay'
import { loadRegisterSort, saveRegisterSort, sortRows, toggleSort } from '../lib/registerSort'
import { useToast } from '../hooks/useToast'
import { useUser } from '../hooks/useUser'

function statusBadge(status: string) {
  const v =
    status === 'Complete' || status === 'Matched' || status === 'Settled' || status === 'Reconciled' || status === 'Paid'
      ? 'success'
      : status === 'Critical missing' || status === 'Critical' || status === 'Overdue' || status === 'Overpayment'
        ? 'danger'
        : status === 'Exception' || status === 'Variance' || status === 'Missing documents' || status === 'Underpayment' || status === 'Open'
          ? 'warning'
          : 'default'
  return <Badge variant={v}>{status || '—'}</Badge>
}

export function ReportViewPage() {
  const { reportId = '' } = useParams()
  const def = getReport(reportId)
  const store = useTradeStore()
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useUser()
  const [filters, setFilters] = useState(emptyReportFilters)
  const [sort, setSort] = useState(() => loadRegisterSort(`report-${reportId}`, 'date'))
  const [exception, setException] = useState<ReportRow | null>(null)
  const [ignoreReason, setIgnoreReason] = useState('')
  const [nextStatus, setNextStatus] = useState<ExceptionStatus>('Under Review')
  const [notes, setNotes] = useState('')
  const [tick, setTick] = useState(0)

  const built = useMemo(() => {
    if (!def) return { columns: [], rows: [] as ReportRow[] }
    return buildReport(def.id, store)
  }, [def, store, tick])

  const [visibleKeys, setVisibleKeys] = useState<string[]>([])

  useEffect(() => {
    setSort(loadRegisterSort(`report-${reportId}`, 'date'))
    setFilters(emptyReportFilters())
  }, [reportId])

  const columnSignature = built.columns.map(c => c.key).join(',')

  useEffect(() => {
    if (!columnSignature) return
    setVisibleKeys(loadVisibleColumns(reportId, built.columns))
  }, [reportId, columnSignature])

  const displayColumns = useMemo(() => {
    const keys = visibleKeys.filter(k => built.columns.some(c => c.key === k))
    const use = keys.length ? keys : built.columns.map(c => c.key)
    return built.columns.filter(c => use.includes(c.key))
  }, [built.columns, visibleKeys])

  const filtered = useMemo(() => applyReportFilters(built.rows, filters), [built.rows, filters])
  const sorted = useMemo(
    () => sortRows(filtered, sort, (row, key) => {
      const v = row[key]
      if (typeof v === 'number') return v
      return String(v ?? '')
    }),
    [filtered, sort],
  )

  if (!def) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Report not found" breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Unknown' }]} />} />
        <Button to="/reports">Back to Reports</Button>
      </div>
    )
  }

  const items = uniqueSorted(built.rows.map(r => r.item || ''))
  const customers = uniqueSorted(built.rows.map(r => r.customer || ''))
  const suppliers = uniqueSorted(built.rows.map(r => r.supplier || ''))
  const brokers = uniqueSorted(built.rows.map(r => r.broker || ''))
  const statuses = uniqueSorted(built.rows.map(r => r.status || ''))

  const filename = def.title.replace(/\s+/g, '-').toLowerCase()

  const columns = displayColumns.map(col => ({
    key: col.key,
    header: col.header,
    sortable: true,
    sortValue: (row: ReportRow) => row[col.key] ?? '',
    render: (row: ReportRow) => {
      if (col.key === 'status' || col.key === 'severity' || col.key === 'flags' || col.key === 'payment' || col.key === 'delivery') {
        return statusBadge(String(row[col.key] ?? ''))
      }
      return String(row[col.key] ?? '—')
    },
  }))

  return (
    <div className="animate-fade-in report-print-root">
      <PageHeader
        title={def.title}
        subtitle={def.subtitle}
        breadcrumb={<Breadcrumb items={[
          { label: 'Tradeal', href: '/' },
          { label: 'Reports', href: '/reports' },
          { label: def.title },
        ]} />}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <ColumnPicker reportId={reportId} columns={built.columns} visible={displayColumns.map(c => c.key)} onChange={setVisibleKeys} />
            <Button variant="outline" size="sm" onClick={() => { window.print() }}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReportCsv({ columns: displayColumns, rows: sorted }, filename)}>
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReportExcel(def.title, { columns: displayColumns, rows: sorted }, filename)}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadReportPdf(def.title, { columns: displayColumns, rows: sorted }, def.subtitle)}>
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <p className="text-xs text-muted mb-4">
        Live Tradeal records for this organisation. Reports do not change orders, lifts, or inventory.
        {def.id === 'audit-trail' ? ' This trail is append-only.' : null}
      </p>

      <ReportFiltersBar
        filters={filters}
        onChange={setFilters}
        items={items}
        customers={customers}
        suppliers={suppliers}
        brokers={brokers}
        statuses={statuses}
      />

      <DataTable
        columns={columns}
        data={sorted}
        getRowId={r => r.id}
        stickyFirstColumn
        paginate
        sortKey={sort.key}
        sortDirection={sort.direction}
        onSortChange={key => {
          const next = toggleSort(sort, key)
          setSort(next)
          saveRegisterSort(`report-${reportId}`, next)
        }}
        onRowClick={row => {
          if (def.id === 'exceptions') {
            setException(row)
            setNextStatus((row.status as ExceptionStatus) || 'Under Review')
            setNotes(String(row.notes === '—' ? '' : row.notes))
            setIgnoreReason('')
            return
          }
          if (row.href) navigate(row.href)
        }}
        emptyMessage="No rows for these filters"
      />

      <Modal
        open={Boolean(exception)}
        onClose={() => setException(null)}
        title="Exception"
        size="md"
        footer={
          <>
            {exception?.href && (
              <Button variant="outline" to={exception.href} onClick={() => setException(null)}>
                Open transaction
              </Button>
            )}
            <Button
              onClick={() => {
                if (!exception) return
                if (nextStatus === 'Ignored' && !ignoreReason.trim()) {
                  toast.error('Add a reason to ignore this exception')
                  return
                }
                saveExceptionOverlay(exception.id, {
                  status: nextStatus,
                  assignee: profile.name,
                  resolution: nextStatus === 'Ignored' ? ignoreReason.trim() : nextStatus,
                  resolvedAt: nextStatus === 'Resolved' || nextStatus === 'Ignored' ? new Date().toISOString().slice(0, 10) : '',
                  notes: notes.trim(),
                })
                setTick(t => t + 1)
                setException(null)
                toast.success('Exception updated')
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {exception && (
          <div className="space-y-4">
            <p className="text-sm text-heading">{String(exception.issue)}</p>
            <p className="text-sm text-muted">{String(exception.ref)} · {String(exception.severity)}</p>
            <Select
              label="Status"
              value={nextStatus}
              options={[
                { value: 'Open', label: 'Open' },
                { value: 'Under Review', label: 'Under Review' },
                { value: 'Resolved', label: 'Resolved' },
                { value: 'Ignored', label: 'Ignored' },
              ]}
              onChange={e => setNextStatus(e.target.value as ExceptionStatus)}
            />
            {nextStatus === 'Ignored' && (
              <Input label="Reason (required)" value={ignoreReason} onChange={e => setIgnoreReason(e.target.value)} />
            )}
            <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        )}
      </Modal>
    </div>
  )
}
