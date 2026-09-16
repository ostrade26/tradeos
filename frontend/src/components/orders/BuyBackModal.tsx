import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { QtyInput } from '../ui/QtyInput'
import type { TradeOrder } from '../../data/mockData'
import {
  canBuyBackPO,
  maxBuyBackQty,
  suggestedBuyBackRatePer10Kg,
  type BuyBackInput,
} from '../../lib/buyBack'
import {
  contractRateFromOrder,
  formatContractRate,
  orderLineAmount,
  parseRateNumber,
  rateInputLabel,
  syncedRateFields,
} from '../../lib/orderRate'
import { formatCurrency, formatQty } from '../../lib/utils'
import { useTradeStore } from '../../store/TradeStore'
import { useToast } from '../../hooks/useToast'

interface BuyBackModalProps {
  order: TradeOrder | null
  open: boolean
  onClose: () => void
  onComplete?: () => void
}

export function BuyBackModal({ order, open, onClose, onComplete }: BuyBackModalProps) {
  const { buyBackPo, getSOsForPO, lifts, tradeOrders } = useTradeStore()
  const toast = useToast()
  const [qty, setQty] = useState('')
  const [rate, setRate] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const resetKeyRef = useRef<string | null>(null)

  const linkedSOs = useMemo(
    () => (order ? getSOsForPO(order.ref) : []),
    [order?.id, order?.ref, getSOsForPO, tradeOrders],
  )

  const eligibility = useMemo(
    () => (order ? canBuyBackPO(order, lifts, linkedSOs) : { ok: false }),
    [order, lifts, linkedSOs],
  )

  const maxQty = order ? maxBuyBackQty(order, linkedSOs) : 0
  const poRate10 = order ? contractRateFromOrder(order.rate, order.rateBasis, order.ratePerBasis) : 0

  useEffect(() => {
    if (!open || !order) {
      if (!open) resetKeyRef.current = null
      return
    }
    const resetKey = order.id
    if (resetKeyRef.current === resetKey) return
    resetKeyRef.current = resetKey

    const sos = getSOsForPO(order.ref)
    setQty(String(maxBuyBackQty(order, sos)))
    setRate(String(suggestedBuyBackRatePer10Kg(order)))
    setDate(new Date().toISOString().slice(0, 10))
    setRemarks('')
    setError('')
  }, [open, order, getSOsForPO])

  if (!order) return null

  const qtyNum = parseFloat(qty) || 0
  const rateNum = parseRateNumber(rate)
  const buyBackAmount = orderLineAmount(qtyNum, rateNum, order.rateBasis)
  const originalAmount = orderLineAmount(qtyNum, poRate10, order.rateBasis)
  const premium = buyBackAmount - originalAmount

  const handleSubmit = async () => {
    setError('')
    if (!eligibility.ok) {
      setError(eligibility.reason ?? 'Buy back is not available.')
      return
    }
    if (qtyNum <= 0 || qtyNum > maxQty) {
      setError(`Enter a quantity up to ${formatQty(maxQty)}.`)
      return
    }
    if (rateNum <= 0) {
      setError('Enter a valid buy-back rate.')
      return
    }

    const rateFields = syncedRateFields(rateNum)
    const payload: BuyBackInput = {
      qtyMt: qtyNum,
      rate: rateFields.rate,
      rateBasis: rateFields.rateBasis,
      ratePerBasis: rateFields.ratePerBasis,
      date,
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
    }

    setSaving(true)
    try {
      await buyBackPo(order.id, payload)
      toast.success('Buy back recorded', {
        description: `${formatQty(qtyNum)} from ${order.partyName} @ ${formatContractRate(rateFields.rate, rateFields.rateBasis, rateFields.ratePerBasis)}`,
      })
      onComplete?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record buy back.')
      toast.error('Could not record buy back', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buy back"
      subtitle={(
        <span className="tabular-nums">
          {formatQty(order.orderQty)} @ {formatContractRate(order.rate, order.rateBasis, order.ratePerBasis)}
        </span>
      )}
      size="md"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} loading={saving} disabled={saving || !eligibility.ok}>
            Confirm buy back
          </Button>
        </div>
      )}
    >
      <div className="space-y-5 py-1">
        {!eligibility.ok ? (
          <p className="text-sm text-warning">{eligibility.reason}</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <QtyInput
              label="Quantity to buy back (MT)"
              value={qty}
              onChange={e => setQty(e.target.value)}
              maxQty={maxQty}
              maxQtyMessage={`Maximum ${formatQty(maxQty)}`}
            />
            <Input
              label={rateInputLabel('Buy-back', order.rateBasis)}
              value={rate}
              onChange={e => setRate(e.target.value)}
            />

            {linkedSOs.length > 0 && (
              <p className="col-span-2 text-xs text-muted -mt-2">
                {formatQty(getAllocatedSoQty(linkedSOs))} allocated to linked sales orders.
              </p>
            )}

            <Input
              label="Date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />

            <Input
              label="Remarks (optional)"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Optional note"
            />

            {qtyNum > 0 && rateNum > 0 && (
              <div className="col-span-2 rounded-md bg-gray-100/90 px-4 py-3 dark:bg-gray-800/50 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted">Buy-back value</span>
                  <span className="font-semibold tabular-nums text-heading">{formatCurrency(buyBackAmount)}</span>
                </div>
                {premium > 0 && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted">Premium over PO</span>
                    <span className="font-semibold tabular-nums text-success">+{formatCurrency(premium)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}

function getAllocatedSoQty(linkedSOs: TradeOrder[]) {
  return linkedSOs.reduce((sum, o) => sum + o.orderQty, 0)
}
