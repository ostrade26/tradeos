import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { ParsedContractPdf } from '../../lib/parseContractPdf'
import { CURRENT_TRADER } from '../../data/mockData'
import { formatContractRate } from '../../lib/orderRate'
import { cn, formatDate, formatDeliveryPeriodRange, formatQty } from '../../lib/utils'

interface ReviewField {
  label: string
  value: string
  ok: boolean
}

function field(label: string, value: string | number | undefined, required = true): ReviewField {
  const str = value == null || value === '' ? '' : String(value)
  const ok = required ? str.length > 0 : true
  return { label, value: str || '—', ok: required ? ok : str.length > 0 || ok }
}

export function buildPdfReviewFields(
  parsed: ParsedContractPdf,
  isPO: boolean,
  itemCorrection?: { from: string; to: string } | null,
): ReviewField[] {
  const itemValue = itemCorrection
    ? `${itemCorrection.to} (PDF: ${itemCorrection.from})`
    : parsed.itemName

  return [
    field('Contract #', parsed.brokerContractRef),
    field('Date', parsed.contractDate ? formatDate(parsed.contractDate) : ''),
    field('Seller', isPO ? parsed.sellerName : CURRENT_TRADER),
    field('Seller confirmed by', parsed.sellerConfirmedBy, false),
    field('Buyer', isPO ? CURRENT_TRADER : parsed.buyerName, !isPO),
    field('Buyer confirmed by', parsed.buyerConfirmedBy, false),
    field('Item', itemValue),
    field('Quantity', parsed.quantityMt ? formatQty(parsed.quantityMt) : ''),
    field('Rate', parsed.ratePerMt ? formatContractRate(parsed.ratePerMt) : ''),
    field('Delivery period', parsed.deliveryType === 'ready'
      ? 'Ready'
      : parsed.deliveryPeriodStart && parsed.deliveryPeriodEnd
        ? formatDeliveryPeriodRange(parsed.deliveryPeriodStart, parsed.deliveryPeriodEnd)
        : ''),
    field('Payment terms', parsed.paymentTerms, false),
  ]
}

export function PdfImportReview({
  parsed,
  isPO,
  itemCorrection,
}: {
  parsed: ParsedContractPdf
  isPO: boolean
  itemCorrection?: { from: string; to: string } | null
}) {
  const fields = buildPdfReviewFields(parsed, isPO, itemCorrection)
  const missing = fields.filter(f => !f.ok).length

  return (
    <div>
      <p className={cn(
        'text-xs font-medium mb-3',
        missing > 0
          ? 'text-amber-800 dark:text-amber-300'
          : 'text-emerald-800 dark:text-emerald-300',
      )}>
        {missing > 0 ? `${missing} field${missing === 1 ? '' : 's'} need attention` : 'All key fields found'}
      </p>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {fields.map(f => (
          <div key={f.label} className="flex items-start justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
            <div className="flex items-center gap-2 min-w-0 shrink-0">
              {f.ok ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              )}
              <span className="text-muted">{f.label}</span>
            </div>
            <span className={cn('font-medium text-right truncate', !f.ok && 'text-warning')}>{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
