import jsPDF from 'jspdf'
import { formatCurrency, formatDate, formatQty } from './utils'
import { parseIndianAmount } from './indianAmount'
import { orderLineAmount } from './orderRate'

export type BrokerContractPdfInput = {
  contractRef?: string
  buyer: string
  seller: string
  broker: string
  commodity: string
  quantity: string
  unit: string
  rate: string
  brokerage: string
  deliveryPeriod: string
  location: string
  paymentTerms: string
  note: string
}

function safeFilenamePart(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'contract'
}

export function suggestedBrokerContractFilename(input: BrokerContractPdfInput): string {
  const ref = (input.contractRef || 'draft').trim().replace(/\s+/g, '-')
  const item = safeFilenamePart(input.commodity || 'contract')
  return `${ref}-${item}.pdf`
}

function addLine(doc: jsPDF, y: number, label: string, value: string): number {
  if (!value.trim()) return y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`${label}:`, 14, y)
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(value.trim(), 182)
  doc.text(lines, 52, y)
  return y + Math.max(6, lines.length * 5)
}

export function buildBrokerContractPdfBlob(input: BrokerContractPdfInput): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const qty = parseFloat(input.quantity) || 0
  const rate = parseIndianAmount(input.rate)
  const value = orderLineAmount(qty, rate)
  const generated = formatDate(new Date().toISOString().slice(0, 10))
  const ref = (input.contractRef || 'Draft').trim()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Contract confirmation', 14, 18)

  doc.setFontSize(11)
  doc.text(`Contract no. ${ref}`, 14, 26)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(`Broker: ${input.broker.trim() || '—'} · Generated ${generated}`, 14, 32)
  doc.setTextColor(0)

  let y = 42
  y = addLine(doc, y, 'Buyer', input.buyer)
  y = addLine(doc, y, 'Seller', input.seller)
  y = addLine(doc, y, 'Commodity', input.commodity)
  y = addLine(doc, y, 'Quantity', qty > 0 ? `${formatQty(qty, input.unit || 'MT')}` : input.quantity)
  y = addLine(doc, y, 'Rate', input.rate.trim() ? `${formatCurrency(rate)}/10 KG` : '')
  y = addLine(doc, y, 'Value', value > 0 ? formatCurrency(value) : '')
  y = addLine(doc, y, 'Brokerage', input.brokerage.trim() ? `${input.brokerage.trim()}%` : '')
  y = addLine(doc, y, 'Delivery', input.deliveryPeriod)
  y = addLine(doc, y, 'Location', input.location)
  y = addLine(doc, y, 'Payment', input.paymentTerms)
  if (input.note.trim()) {
    y = addLine(doc, y, 'Note', input.note)
  }

  y += 4
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(
    'When this party joins Tradeal, they can import this PDF on Purchase or Sales order entry to book the contract.',
    14,
    y,
    { maxWidth: 182 },
  )

  return doc.output('blob')
}

export function brokerContractPdfDataUrl(input: BrokerContractPdfInput): Promise<string> {
  const blob = buildBrokerContractPdfBlob(input)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function downloadBrokerContractPdf(input: BrokerContractPdfInput) {
  const blob = buildBrokerContractPdfBlob(input)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = suggestedBrokerContractFilename(input)
  anchor.click()
  URL.revokeObjectURL(url)
}
