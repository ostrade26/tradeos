import {
  CURRENT_TRADER,
  formatDeliveryPeriod,
  toBeLifted,
  type Lift,
  type OrderStatus,
  type TradeOrder,
} from '../data/mockData'
import { formatContractRate } from './orderRate'
import { getLiftTankers } from './liftTankers'
import { getLiftAllocations } from './liftAllocations'
import { LOAD_ON_RISK_WHATSAPP_LINES } from './loadOnRisk'
import { formatCurrency, formatDate, formatQty } from './utils'
import { formatLiftRef, formatOrderRef, formatPoRef, formatSoRef } from './tradeRefs'

const DIVIDER = '─────────────────'

function formatStatus(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: 'Pending',
    partial: 'Partially lifted',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return labels[status] ?? status
}

function bullet(label: string, value: string): string {
  return `• *${label}:* ${value}`
}

function section(title: string, lines: string[]): string {
  const body = lines.filter(Boolean)
  if (body.length === 0) return ''
  return `\n*${title}*\n${body.join('\n')}`
}

function footer(): string {
  return `\n${DIVIDER}\n_Shared from TradeOS · ${CURRENT_TRADER}_`
}

export function openWhatsAppShare(text: string, phone?: string) {
  const encoded = encodeURIComponent(text)
  const url = phone
    ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function formatOrderWhatsAppMessage(order: TradeOrder): string {
  const isPO = order.side === 'purchase'
  const title = isPO ? 'PURCHASE ORDER' : 'SALES ORDER'
  const amount = order.orderQty * order.rate
  const tax = amount * (order.taxRate / 100)
  const total = amount + tax
  const pending = toBeLifted(order)

  const partyLines = [
    bullet(isPO ? 'Seller' : 'Buyer', order.partyName),
    isPO ? bullet('Buyer', order.buyerName || CURRENT_TRADER) : '',
    !isPO ? bullet('Seller', order.sellerName || CURRENT_TRADER) : '',
    !isPO ? bullet('Linked PO', order.poRef ?? 'Not linked yet') : '',
  ]

  const commodityLines = [
    bullet('Item', order.itemName),
    bullet('Spot', order.spot),
    bullet('Delivery', formatDeliveryPeriod(order)),
  ]

  const termsLines = [
    bullet('Rate', formatContractRate(order.rate, order.rateBasis, order.ratePerBasis)),
    bullet('Quantity', formatQty(order.orderQty)),
    bullet('Order value', formatCurrency(amount)),
    order.taxRate > 0 ? bullet(`Tax (${order.taxRate}%)`, formatCurrency(tax)) : '',
    order.taxRate > 0 ? bullet('Total', formatCurrency(total)) : '',
  ]

  const liftLines = [
    bullet('Lifted', formatQty(order.liftedQty)),
    bullet('To be lifted', formatQty(pending)),
    bullet('Status', formatStatus(order.status)),
  ]

  const otherLines = [
    order.brokerName ? bullet('Broker', order.brokerName) : '',
    order.brokerContractRef ? bullet('Contract #', order.brokerContractRef) : '',
    order.brokeragePerTon ? bullet('Brokerage', `₹${order.brokeragePerTon.toLocaleString('en-IN')}/MT`) : '',
    order.paymentTerms ? bullet('Payment', order.paymentTerms) : '',
    order.unloading ? bullet('Unloading', order.unloading) : '',
    order.remarks ? bullet('Remarks', order.remarks) : '',
  ].filter(Boolean)

  const blocks = [
    `*${title}*`,
    `*${formatOrderRef(order.ref, order.side)}*  ·  ${formatDate(order.date)}`,
    section('PARTIES', partyLines),
    section('COMMODITY', commodityLines),
    section('TERMS', termsLines),
    section('LIFT STATUS', liftLines),
    otherLines.length > 0 ? section('OTHER DETAILS', otherLines) : '',
    footer(),
  ]

  return blocks.filter(Boolean).join('\n').trim()
}

export function formatLiftWhatsAppMessage(lift: Lift): string {
  const allocations = getLiftAllocations(lift)
  const value = allocations.reduce((sum, a) => sum + a.qtyMt * lift.rate, 0)

  const dealLines = allocations.flatMap(a => [
    bullet(
      a.soRef ? `${formatSoRef(a.soRef)} / ${formatPoRef(a.poRef)}` : `${formatPoRef(a.poRef)} (stock)`,
      formatQty(a.qtyMt),
    ),
  ]).concat([
    bullet('Date', formatDate(lift.date)),
  ])

  const partyLines = [
    bullet('Seller', lift.sellerName),
    bullet('Buyer', lift.buyerName),
  ]

  const dispatchLines = [
    bullet('Item', lift.itemName),
    bullet('Qty lifted', formatQty(lift.liftedQty)),
    bullet('Rate', formatContractRate(lift.rate)),
    bullet('Value', formatCurrency(value)),
    bullet('Delivery period', lift.deliveryPeriod),
  ]

  const tankerLines = getLiftTankers(lift)
    .filter(t => t.tankerNo.trim())
    .map((t, i) => {
      const details = [
        t.actualQtyMt != null ? formatQty(t.actualQtyMt) : '',
        t.lrNo ? `LR ${t.lrNo.toUpperCase()}` : '',
        t.transportName,
        t.driverMobile ? `Driver ${t.driverMobile}` : '',
      ].filter(Boolean).join(' · ')
      const value = details
        ? `${t.tankerNo.toUpperCase()} (${details})`
        : t.tankerNo.toUpperCase()
      return bullet(`Tanker ${i + 1}`, value)
    })

  const logisticsLines = [
    ...tankerLines,
    lift.salesInvoiceNo ? bullet('Sales invoice', lift.salesInvoiceNo) : '',
    bullet('Lift type', lift.isSelfLift ? 'Self lift' : 'Broker / third party'),
  ].filter(Boolean)

  const riskSection = lift.loadOnRisk
    ? section('LOAD ON RISK', [...LOAD_ON_RISK_WHATSAPP_LINES])
    : ''

  const blocks = [
    `*LIFT RECORD*`,
    `*${formatLiftRef(lift.liftRef)}*  ·  ${formatDate(lift.date)}`,
    section('DEAL', dealLines),
    section('PARTIES', partyLines),
    section('DISPATCH', dispatchLines),
    section('LOGISTICS', logisticsLines),
    riskSection,
    footer(),
  ]

  return blocks.filter(Boolean).join('\n').trim()
}

export function shareOrderOnWhatsApp(order: TradeOrder) {
  openWhatsAppShare(formatOrderWhatsAppMessage(order))
}

export function shareLiftOnWhatsApp(lift: Lift) {
  openWhatsAppShare(formatLiftWhatsAppMessage(lift))
}
