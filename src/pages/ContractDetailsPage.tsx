import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { Download, Mail, FileText, Truck, MessageSquare, Package } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, Tabs, Timeline, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatusBadge, Badge } from '../components/ui/Badge'
import { DataTable } from '../components/ui/DataTable'
import { formatCurrency, formatDate, formatDateTime, formatQty } from '../lib/utils'
import { formatContractRate } from '../lib/orderRate'
import { useTradeStore } from '../store/TradeStore'
import { useToast } from '../hooks/useToast'

export function ContractDetailsPage() {
  const { contracts, payments, deliveries, lots } = useTradeStore()
  const { id } = useParams()
  const contract = contracts.find(c => c.id === id)
  const toast = useToast()
  const [tab, setTab] = useState('overview')

  if (!contract) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Contract not found"
          breadcrumb={<Breadcrumb items={[{ label: 'TradeOS', href: '/' }, { label: 'Contracts', href: '/contracts' }, { label: 'Not found' }]} />}
        />
        <EmptyState
          card
          icon={<FileText className="h-10 w-10" />}
          title="No contract found"
          description="This contract does not exist or has been removed."
          action={<Button to="/contracts" variant="outline">Back to Contracts</Button>}
        />
      </div>
    )
  }

  const relatedPayments = payments.filter(p => p.contractRef === contract.ref)
  const relatedDelivery = deliveries.find(d => d.contractRef === contract.ref)
  const linkedLots = lots.filter(l => l.contractId === contract.id)

  const timelineItems = [
    { title: 'Contract Created', description: `Draft created by ${contract.broker}`, time: formatDateTime(contract.createdAt), status: 'completed' as const },
    { title: 'Sent for Confirmation', description: 'Emailed to buyer and seller', time: formatDateTime(contract.createdAt), status: 'completed' as const },
    { title: 'Buyer Confirmed', description: `${contract.buyer} accepted terms`, time: 'Aug 2, 2026, 10:30 AM', status: 'completed' as const },
    { title: 'Advance Payment', description: relatedPayments[0] ? `${formatCurrency(relatedPayments[0].amount)} received` : 'Pending', time: relatedPayments[0]?.paidDate ? formatDate(relatedPayments[0].paidDate!) : 'Pending', status: relatedPayments[0]?.paidDate ? 'completed' as const : 'current' as const },
    { title: 'Goods Dispatch', description: relatedDelivery ? `${formatQty(relatedDelivery.quantity, relatedDelivery.unit)} dispatched` : 'Awaiting dispatch', time: relatedDelivery?.scheduledDate ? formatDate(relatedDelivery.scheduledDate) : 'TBD', status: relatedDelivery?.status === 'delivered' ? 'completed' as const : relatedDelivery?.status === 'in_transit' ? 'current' as const : 'upcoming' as const },
    { title: 'Delivery Complete', description: `Deliver to ${contract.location}`, time: formatDate(contract.deliveryDate), status: 'upcoming' as const },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={contract.ref}
        subtitle={`${contract.commodity} · ${formatQty(contract.quantity, contract.unit)} · ${contract.buyer} ↔ ${contract.seller}`}
        breadcrumb={<Breadcrumb items={[
          { label: 'TradeOS', href: '/' },
          { label: 'Contracts', href: '/contracts' },
          { label: contract.ref },
        ]} />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast.info('PDF export is not available yet')}><Download className="h-4 w-4" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => toast.info('Email sending is not available yet')}><Mail className="h-4 w-4" /> Email</Button>
            <StatusBadge status={contract.status} />
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card padding={false}>
            <Tabs tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'payments', label: 'Payments', count: relatedPayments.length },
              { id: 'delivery', label: 'Delivery' },
              { id: 'documents', label: 'Documents' },
              { id: 'activity', label: 'Activity' },
            ]} active={tab} onChange={setTab} className="px-5" />

            <div className="p-5">
              {tab === 'overview' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {[
                    { label: 'Contract Value', value: formatCurrency(contract.value) },
                    { label: 'Rate', value: formatContractRate(contract.rate) },
                    { label: 'Quantity', value: formatQty(contract.quantity, contract.unit) },
                    { label: 'Buyer', value: contract.buyer },
                    { label: 'Seller', value: contract.seller },
                    { label: 'Broker', value: contract.broker },
                    { label: 'Delivery Date', value: formatDate(contract.deliveryDate) },
                    { label: 'Location', value: contract.location },
                    { label: 'Payment Status', value: contract.paymentStatus },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs text-muted">{item.label}</p>
                      <p className="text-sm font-medium text-heading mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'payments' && (
                <DataTable
                  paginate={false}
                  columns={[
                    { key: 'type', header: 'Type', render: (r: typeof relatedPayments[0]) => <Badge variant="default">{r.type}</Badge> },
                    { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount), className: 'text-right font-medium' },
                    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'dueDate', header: 'Due', render: (r) => formatDate(r.dueDate) },
                    { key: 'paidDate', header: 'Paid', render: (r) => r.paidDate ? formatDate(r.paidDate) : '—' },
                    { key: 'method', header: 'Method', render: (r) => r.method || '—' },
                  ]}
                  data={relatedPayments}
                />
              )}

              {tab === 'delivery' && relatedDelivery && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-muted">Status</p><StatusBadge status={relatedDelivery.status} /></div>
                    <div><p className="text-xs text-muted">Scheduled</p><p className="text-sm font-medium">{formatDate(relatedDelivery.scheduledDate)}</p></div>
                    <div><p className="text-xs text-muted">From</p><p className="text-sm font-medium">{relatedDelivery.from}</p></div>
                    <div><p className="text-xs text-muted">To</p><p className="text-sm font-medium">{relatedDelivery.to}</p></div>
                    {relatedDelivery.truckNumber && <div><p className="text-xs text-muted">Truck</p><p className="text-sm font-medium">{relatedDelivery.truckNumber}</p></div>}
                    {relatedDelivery.driverName && <div><p className="text-xs text-muted">Driver</p><p className="text-sm font-medium">{relatedDelivery.driverName} · {relatedDelivery.driverPhone}</p></div>}
                  </div>
                </div>
              )}

              {tab === 'documents' && (
                <div className="space-y-2">
                  {['Contract Confirmation.pdf', 'Purchase Order.pdf', 'Quality Certificate.pdf'].map(doc => (
                    <div key={doc} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted" />
                        <span className="text-sm">{doc}</span>
                      </div>
                      <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'activity' && (
                <div className="space-y-3">
                  {timelineItems.map((item, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <div className="h-2 w-2 rounded-full bg-accent mt-1.5 shrink-0" />
                      <div>
                        <p className="font-medium text-heading">{item.title}</p>
                        <p className="text-xs text-muted">{item.description}</p>
                        <p className="text-xs text-muted mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-muted" />
              <h3 className="text-sm font-semibold text-heading">Broker Notes</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-muted">Producer confirmed availability. Quality grade A, FFA max 5%. Buyer requested delivery by Aug 12. Advance payment of 50% expected by Aug 5.</p>
            <p className="text-xs text-muted mt-2">— Rajesh Mehta · Aug 1, 2026</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-semibold text-heading mb-4">Contract Timeline</h3>
            <Timeline items={timelineItems} />
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-heading mb-3">Linked Resources</h3>
            <div className="space-y-2">
              {linkedLots.length > 0 ? linkedLots.map(lot => (
                <Link key={lot.id} to={`/inventory/${lot.id}`} className="flex items-center gap-2 text-sm text-accent hover:underline">
                  <Package className="h-4 w-4" /> {lot.lotNumber}
                </Link>
              )) : (
                <p className="text-sm text-muted">No inventory lots linked to this contract.</p>
              )}
              <Link to="/lifts" className="flex items-center gap-2 text-sm text-accent hover:underline">
                <Truck className="h-4 w-4" /> Open Lift Register
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
