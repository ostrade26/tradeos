import { organisationApi } from '../api/organisationApi'
import { dispatchContractSharesRefresh } from './contractSharesRefresh'
import type { Lift } from '../data/mockData'
import { tankerQtyLinesFromLift } from './tankerQtyLines'
import { formatPoRef, formatSoRef } from './tradeRefs'

function orderRefsFromLift(lift: Lift): string[] {
  const refs = new Set<string>()
  for (const allocation of lift.allocations ?? []) {
    if (allocation.poRef) refs.add(formatPoRef(allocation.poRef))
    if (allocation.soRef) refs.add(formatSoRef(allocation.soRef))
  }
  if (lift.poRef) refs.add(formatPoRef(lift.poRef))
  if (lift.soRef) refs.add(formatSoRef(lift.soRef))
  return [...refs]
}

/** Fire-and-forget: mirror lift movement onto a broker contract when the order was booked from a share. */
export function syncBrokerShareLiftReport(lift: Lift): void {
  const status = lift.status === 'delivered' ? 'delivered' : 'pending'
  const eventAt = lift.status === 'delivered' && lift.deliveredAt ? lift.deliveredAt : lift.date
  const qtyMt = lift.liftedQty ?? lift.plannedQtyMt ?? 0
  const tankersOnLift = lift.tankers ?? []
  const qtyLines = tankerQtyLinesFromLift(lift)
  const tankers = tankersOnLift.map((tanker, index) => {
    const line = qtyLines[index] ?? qtyLines[0]
    const plannedQty = line?.plannedMt ?? 0
    const actualQty = line?.actualMt ?? 0
    const qty = status === 'delivered' ? actualQty : plannedQty
    return {
      tanker_no: tanker.tankerNo,
      transport_name: tanker.transportName,
      driver_mobile: tanker.driverMobile,
      lr_no: tanker.lrNo,
      qty_mt: qty,
      planned_qty_mt: plannedQty,
      actual_qty_mt: actualQty,
      sales_invoice_no: tanker.salesInvoiceNo ?? '',
      po_invoice_no: tanker.poInvoiceNo ?? '',
    }
  })
  for (const orderRef of orderRefsFromLift(lift)) {
    void organisationApi
      .reportBrokerShareLift({
        lift_id: lift.id,
        lift_ref: lift.liftRef,
        order_ref: orderRef,
        qty_mt: qtyMt,
        status,
        event_at: eventAt,
        tankers,
      })
      .then(res => {
        if (res.linked) dispatchContractSharesRefresh()
      })
      .catch(() => {
        // Not linked to a broker contract — expected for most lifts.
      })
  }
}
