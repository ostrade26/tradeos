import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileArchive } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Card, CardHeader, StatCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Drawer'
import { Checkbox } from '../components/ui/Checkbox'
import { Select } from '../components/ui/Select'
import { DatePicker } from '../components/ui/DatePicker'
import { StatGrid } from '../components/layout/PageGrid'
import { useTradeStore } from '../store/TradeStore'
import { useToast } from '../hooks/useToast'
import { AUDIT_PACK_REPORTS, REPORT_GROUPS, REPORTS, getReport, type ReportGroupId } from '../lib/reports/catalog'
import { buildReport } from '../lib/reports/builders'
import { detectExceptions } from '../lib/reports/exceptions'
import { applyReportFilters, emptyReportFilters } from '../lib/reports/filters'
import { listFinancialYears } from '../lib/reports/fy'
import { exportAuditSupportPack } from '../lib/reports/exportWorkbook'

const PRIMARY_REPORT_GROUPS: ReportGroupId[] = ['trading', 'inventory', 'finance']
const SECONDARY_REPORT_GROUPS: ReportGroupId[] = ['audit', 'invoicing', 'profitability']

function ReportGroupCard({ groupId }: { groupId: ReportGroupId }) {
  const group = REPORT_GROUPS.find(g => g.id === groupId)
  if (!group) return null

  return (
    <Card padding={false} className="h-full">
      <div className="p-6">
        <CardHeader title={group.label} />
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
          {REPORTS.filter(r => r.group === groupId).map(report => (
            <li key={report.id}>
              <Link
                to={`/reports/${report.id}`}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-heading">{report.title}</span>
                  <span className="block text-sm text-caption mt-0.5 leading-snug">{report.subtitle}</span>
                </span>
                <span className="text-xs text-accent shrink-0 mt-0.5">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

export function ReportsDashboardPage() {
  const store = useTradeStore()
  const toast = useToast()
  const [packOpen, setPackOpen] = useState(false)
  const years = listFinancialYears()
  const [fyId, setFyId] = useState(years[0]?.id ?? '')
  const fy = years.find(y => y.id === fyId)
  const [dateFrom, setDateFrom] = useState(fy?.from ?? '')
  const [dateTo, setDateTo] = useState(fy?.to ?? '')
  const [selected, setSelected] = useState<string[]>(AUDIT_PACK_REPORTS)

  const summary = useMemo(() => {
    const filters = { ...emptyReportFilters(), dateFrom, dateTo }
    const exceptions = applyReportFilters(detectExceptions(store), filters)
    const docs = applyReportFilters(buildReport('document-completeness', store).rows, filters)
    const stock = buildReport('stock-reconciliation', store).rows
    const payments = applyReportFilters(buildReport('payment-reconciliation', store).rows, filters)
    const tx = store.tradeOrders.filter(o => (!dateFrom || o.date >= dateFrom) && (!dateTo || o.date <= dateTo)).length
      + store.lifts.filter(l => (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo)).length
    const openEx = exceptions.filter(e => e.status === 'Open' || e.status === 'Under Review')
    return {
      tx,
      exceptions: exceptions.length,
      critical: exceptions.filter(e => e.severity === 'Critical').length,
      missingDocs: docs.filter(r => r.status !== 'Complete').length,
      stockVar: stock.filter(r => r.status === 'Variance').length,
      payEx: payments.filter(r => ['Unallocated', 'Overpayment', 'Underpayment'].includes(String(r.status))).length,
      reconciled: Math.max(0, tx - openEx.length),
    }
  }, [store, dateFrom, dateTo])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Audit and compliance views over live trading records"
        breadcrumb={<Breadcrumb items={[{ label: 'TradeOS', href: '/' }, { label: 'Reports' }]} />}
        actions={
          <Button onClick={() => setPackOpen(true)}>
            <FileArchive className="h-4 w-4" /> Generate Audit Pack
          </Button>
        }
      />

      <StatGrid cols={7}>
        <StatCard compact label="Transactions" value={String(summary.tx)} to="/reports/purchase-register" />
        <StatCard compact label="Reconciled" value={String(summary.reconciled)} to="/reports/exceptions" />
        <StatCard compact label="Exceptions" value={String(summary.exceptions)} to="/reports/exceptions" />
        <StatCard compact label="Critical" value={String(summary.critical)} to="/reports/exceptions" />
        <StatCard compact label="Missing docs" value={String(summary.missingDocs)} to="/reports/document-completeness" />
        <StatCard compact label="Stock variances" value={String(summary.stockVar)} to="/reports/stock-reconciliation" />
        <StatCard compact label="Payment issues" value={String(summary.payEx)} to="/reports/payment-reconciliation" />
      </StatGrid>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {PRIMARY_REPORT_GROUPS.map(groupId => (
          <ReportGroupCard key={groupId} groupId={groupId} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start mt-4">
        {SECONDARY_REPORT_GROUPS.map(groupId => (
          <ReportGroupCard key={groupId} groupId={groupId} />
        ))}
      </div>

      <Modal
        open={packOpen}
        onClose={() => setPackOpen(false)}
        title="Audit Support Pack"
        size="lg"
        footerClassName="items-center justify-end gap-3"
        footer={
          <>
            <Button variant="outline" className="min-h-11" onClick={() => setPackOpen(false)}>Cancel</Button>
            <Button
              className="min-h-11"
              disabled={selected.length === 0}
              onClick={() => {
                const reports = selected.flatMap(id => {
                  const def = getReport(id)
                  if (!def) return []
                  const built = buildReport(def.id, store)
                  const filtered = applyReportFilters(built.rows, { ...emptyReportFilters(), dateFrom, dateTo })
                  return [{ id: def.id, built: { columns: built.columns, rows: filtered } }]
                })
                exportAuditSupportPack(reports, `tradeos-audit-support-pack-${fyId || 'custom'}`)
                toast.success('Audit Support Pack downloaded')
                setPackOpen(false)
              }}
            >
              Download pack
            </Button>
          </>
        }
      >
        <div className="space-y-8">
          <p className="text-sm text-muted leading-relaxed">
            Download a workbook for you and your CA. It supports internal review — it is not a statutory audit report.
          </p>

          <section className="space-y-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Period</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Financial year"
                value={fyId}
                options={[{ value: '', label: 'Custom range' }, ...years.map(y => ({ value: y.id, label: y.label }))]}
                onChange={e => {
                  const next = years.find(y => y.id === e.target.value)
                  setFyId(e.target.value)
                  if (next) {
                    setDateFrom(next.from)
                    setDateTo(next.to)
                  }
                }}
              />
              <DatePicker label="From" value={dateFrom} onChange={v => { setDateFrom(v); setFyId('') }} />
              <DatePicker label="To" value={dateTo} onChange={v => { setDateTo(v); setFyId('') }} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                Reports to include
                <span className="ml-2 font-normal normal-case tracking-normal text-muted">
                  {selected.length} of {AUDIT_PACK_REPORTS.length}
                </span>
              </h3>
              <button
                type="button"
                className="text-xs font-medium text-accent hover:underline cursor-pointer"
                onClick={() => setSelected(selected.length === AUDIT_PACK_REPORTS.length ? [] : [...AUDIT_PACK_REPORTS])}
              >
                {selected.length === AUDIT_PACK_REPORTS.length ? 'Clear all' : 'Select all'}
              </button>
            </div>

            <div className="space-y-6">
              {REPORT_GROUPS.map(group => {
                const reports = AUDIT_PACK_REPORTS.map(id => getReport(id)).filter(r => r?.group === group.id)
                if (reports.length === 0) return null
                return (
                  <div key={group.id}>
                    <p className="text-sm font-medium text-heading mb-3">{group.label}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                      {reports.map(r => r && (
                        <Checkbox
                          key={r.id}
                          label={r.title}
                          checked={selected.includes(r.id)}
                          onChange={() => setSelected(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </Modal>
    </div>
  )
}
