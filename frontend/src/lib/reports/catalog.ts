export type ReportGroupId = 'trading' | 'inventory' | 'finance' | 'audit' | 'invoicing' | 'profitability'

export type ReportId =
  | 'purchase-register'
  | 'sales-register'
  | 'purchase-vs-invoice'
  | 'sales-vs-invoice'
  | 'contract-summary'
  | 'stock-reconciliation'
  | 'inventory-movement'
  | 'lift-report'
  | 'lift-variance'
  | 'delivery-report'
  | 'customer-outstanding'
  | 'supplier-outstanding'
  | 'payment-reconciliation'
  | 'brokerage'
  | 'credit-debit-note'
  | 'trade-profitability'
  | 'landed-cost'
  | 'document-completeness'
  | 'rate-change'
  | 'exceptions'
  | 'audit-trail'
  | 'audit-summary'

export interface ReportDefinition {
  id: ReportId
  group: ReportGroupId
  title: string
  subtitle: string
}

export const REPORT_GROUPS: { id: ReportGroupId; label: string }[] = [
  { id: 'trading', label: 'Trading' },
  { id: 'inventory', label: 'Inventory & Logistics' },
  { id: 'finance', label: 'Finance' },
  { id: 'audit', label: 'Audit & Compliance' },
  { id: 'invoicing', label: 'Invoice Matching' },
  { id: 'profitability', label: 'Profitability & Costs' },
]

export const REPORTS: ReportDefinition[] = [
  { id: 'purchase-register', group: 'trading', title: 'Purchase Register', subtitle: 'All purchase orders with invoice and delivery status' },
  { id: 'sales-register', group: 'trading', title: 'Sales Register', subtitle: 'All sales orders with invoice, GST, and pending qty' },
  { id: 'purchase-vs-invoice', group: 'invoicing', title: 'Purchase vs Invoice', subtitle: 'Commercial PO versus recorded invoice / lift' },
  { id: 'sales-vs-invoice', group: 'invoicing', title: 'Sales vs Invoice', subtitle: 'SO versus sales invoice on delivered lifts' },
  { id: 'contract-summary', group: 'trading', title: 'Contract Summary', subtitle: 'Broker contract confirmations on file' },
  { id: 'stock-reconciliation', group: 'inventory', title: 'Stock Reconciliation', subtitle: 'Book movement versus Tradeal closing inventory' },
  { id: 'inventory-movement', group: 'inventory', title: 'Inventory Movement', subtitle: 'Receipts and dispatches from lifts' },
  { id: 'lift-report', group: 'inventory', title: 'Lift Report', subtitle: 'Every lift with planned and actual qty' },
  { id: 'lift-variance', group: 'inventory', title: 'Lift Quantity Variance', subtitle: 'Planned versus actual, including carry-forward' },
  { id: 'delivery-report', group: 'inventory', title: 'Delivery Report', subtitle: 'Delivered lifts with invoice and LR' },
  { id: 'customer-outstanding', group: 'finance', title: 'Customer Outstanding', subtitle: 'Receivables by buyer' },
  { id: 'supplier-outstanding', group: 'finance', title: 'Supplier Outstanding', subtitle: 'Payables by seller' },
  { id: 'payment-reconciliation', group: 'finance', title: 'Payment Reconciliation', subtitle: 'Invoices versus payments and unallocated cash' },
  { id: 'brokerage', group: 'profitability', title: 'Brokerage Report', subtitle: 'Accrued brokerage payable by broker' },
  { id: 'credit-debit-note', group: 'profitability', title: 'Credit/Debit Note Report', subtitle: 'Buy-backs, cash settlements, and write-offs' },
  { id: 'trade-profitability', group: 'profitability', title: 'Trade Profitability', subtitle: 'Gross profit by purchase order after landed cost' },
  { id: 'landed-cost', group: 'profitability', title: 'Landed Cost Report', subtitle: 'Purchase value plus freight, loading, brokerage, and other costs' },
  { id: 'document-completeness', group: 'audit', title: 'Document Completeness', subtitle: 'Required papers inferred from live records' },
  { id: 'rate-change', group: 'audit', title: 'Rate Change Report', subtitle: 'Order updates that touch rate (from the activity log)' },
  { id: 'exceptions', group: 'audit', title: 'Transaction Exception Report', subtitle: 'Automatically flagged mismatches and missing records' },
  { id: 'audit-trail', group: 'audit', title: 'Audit Trail', subtitle: 'Append-only activity log — not editable here' },
  { id: 'audit-summary', group: 'audit', title: 'Audit Summary', subtitle: 'High-level counts for the selected period' },
]

export function getReport(id: string): ReportDefinition | undefined {
  return REPORTS.find(r => r.id === id)
}

export const AUDIT_PACK_REPORTS: ReportId[] = [
  'purchase-register',
  'sales-register',
  'stock-reconciliation',
  'customer-outstanding',
  'supplier-outstanding',
  'payment-reconciliation',
  'brokerage',
  'lift-variance',
  'exceptions',
  'audit-trail',
  'document-completeness',
]
