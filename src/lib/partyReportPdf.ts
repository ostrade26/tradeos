import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Lift, TradeOrder } from '../data/mockData'
import { formatCurrency, formatDate, formatQty } from './utils'
import { contractRateFromOrder, formatContractRate, orderLineAmount } from './orderRate'
import { formatLiftPoRefs, formatLiftSoRefs } from './liftAllocations'

export interface PartyReportInput {
  partyName: string
  partyKind: string
  pos: TradeOrder[]
  sos: TradeOrder[]
  lifts: Lift[]
}

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'party'
}

export function downloadPartyReportPdf({ partyName, partyKind, pos, sos, lifts }: PartyReportInput) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const generated = formatDate(new Date().toISOString().slice(0, 10))

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Party Transaction Report', 14, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(partyName, 14, 26)

  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(`${partyKind} · Generated ${generated}`, 14, 32)
  doc.text(`${pos.length} purchase order${pos.length === 1 ? '' : 's'} · ${sos.length} sales order${sos.length === 1 ? '' : 's'} · ${lifts.length} lift${lifts.length === 1 ? '' : 's'}`, 14, 37)
  doc.setTextColor(0)

  let startY = 44

  const section = (title: string, head: string[], body: (string | number)[][]) => {
    if (body.length === 0) return
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title, 14, startY)
    startY += 2

    autoTable(doc, {
      startY,
      head: [head],
      body,
      theme: 'striped',
      headStyles: { fillColor: [39, 39, 42], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    })
    startY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  section(
    'Purchase Orders',
    ['Ref', 'Date', 'Item', 'Qty', 'Rate', 'Lifted', 'Amount', 'Status'],
    pos.map(o => {
      const rate = contractRateFromOrder(o.rate, o.rateBasis, o.ratePerBasis)
      return [
        o.ref,
        formatDate(o.date),
        o.itemName,
        formatQty(o.orderQty),
        formatContractRate(o.rate, o.rateBasis, o.ratePerBasis),
        formatQty(o.liftedQty),
        formatCurrency(orderLineAmount(o.orderQty, rate, o.rateBasis)),
        o.status,
      ]
    }),
  )

  section(
    'Sales Orders',
    ['Ref', 'Date', 'PO', 'PO Qty', 'Item', 'Qty', 'Rate', 'Lifted', 'Amount', 'Status'],
    sos.map(o => {
      const linkedPo = o.poRef ? pos.find(p => p.ref === o.poRef) : undefined
      const rate = contractRateFromOrder(o.rate, o.rateBasis, o.ratePerBasis)
      return [
        o.ref,
        formatDate(o.date),
        o.poRef ?? '—',
        linkedPo ? formatQty(linkedPo.orderQty) : '—',
        o.itemName,
        formatQty(o.orderQty),
        formatContractRate(o.rate, o.rateBasis, o.ratePerBasis),
        formatQty(o.liftedQty),
        formatCurrency(orderLineAmount(o.orderQty, rate, o.rateBasis)),
        o.status,
      ]
    }),
  )

  section(
    'Lifts',
    ['Lift #', 'Date', 'Status', 'PO', 'SO', 'Item', 'Qty', 'Buyer', 'Seller'],
    lifts.map(l => [
      String(l.liftRef),
      formatDate(l.date),
      l.status,
      formatLiftPoRefs(l),
      formatLiftSoRefs(l),
      l.itemName,
      formatQty(l.liftedQty),
      l.buyerName,
      l.sellerName,
    ]),
  )

  if (pos.length === 0 && sos.length === 0 && lifts.length === 0) {
    doc.setFontSize(10)
    doc.text('No transactions recorded with this party yet.', 14, startY)
  }

  doc.save(`party-report-${safeFilename(partyName)}-${generated.replace(/\//g, '-')}.pdf`)
}
