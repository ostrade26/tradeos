import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Radio } from '../ui/Radio'
import type { TradeOrder } from '../../data/mockData'
import { canCloseOrder, type CloseOrderMethod } from '../../lib/orderClosure'
import { contractRateFromOrder, formatContractRate, orderLineAmount } from '../../lib/orderRate'
import { formatCurrency, formatDate, formatQty } from '../../lib/utils'
import { useTradeStore } from '../../store/TradeStore'
import { useToast } from '../../hooks/useToast'

interface CloseOrderModalProps {
  order: TradeOrder | null
  open: boolean
  onClose: () => void
  onComplete?: () => void
}

const METHOD_LABELS: Record<CloseOrderMethod, { title: string; description: string }> = {
  carried_forward: {
    title: 'Adjust in next delivery',
    description: 'Remaining qty stays on the seller and is applied on the next lift.',
  },
  cash: {
    title: 'In cash',
    description: 'Seller settled the remaining qty in cash. Nothing is carried to the next lift.',
  },
  short_closed: {
    title: 'No further delivery',
    description: 'Write off remaining quantity — no more lifts and no cash settlement.',
  },
}

export function CloseOrderModal({ order, open, onClose, onComplete }: CloseOrderModalProps) {
  const store = useTradeStore()
  const toast = useToast()
  const [method, setMethod] = useState<CloseOrderMethod>('cash')
  const [notes, setNotes] = useState('')
  const [settledAt, setSettledAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const context = useMemo(
    () => (order ? canCloseOrder(order, store.lifts, store.balanceSettlements ?? [], store.tradeOrders) : null),
    [order, store.lifts, store.balanceSettlements, store.tradeOrders],
  )

  useEffect(() => {
    if (!open || !order || !context?.ok) return
    setMethod(context.availableMethods[0] ?? 'cash')
    setNotes('')
    setSettledAt(new Date().toISOString().slice(0, 10))
    setError('')
  }, [open, order, context])

  if (!order || !context) return null

  const contractRate = contractRateFromOrder(order.rate, order.rateBasis, order.ratePerBasis)
  const closeQty = context.balanceOwed + context.toBeLifted
  const closeAmount = orderLineAmount(closeQty, contractRate, order.rateBasis)
  const shortLabel = order.side === 'purchase' ? 'PO' : 'SO'

  const handleSubmit = async () => {
    setError('')
    if (!context.ok) {
      setError(context.reason ?? 'Cannot close this order.')
      return
    }
    if (!context.availableMethods.includes(method)) {
      setError('Choose a valid close method.')
      return
    }

    setSaving(true)
    try {
      await store.closeOrder(order.id, {
        method,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(method !== 'short_closed' ? { settledAt } : {}),
      })
      const methodTitle = METHOD_LABELS[method].title
      toast.success('Order closed', { description: `${order.ref} · ${methodTitle}` })
      onComplete?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close order.')
      toast.error('Could not close order', {
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
      title="Close order"
      size="md"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} loading={saving} disabled={saving || !context.ok}>
            Close order
          </Button>
        </div>
      )}
    >
      <div className="space-y-5 py-1">
        <div className="rounded-md bg-gray-100/90 px-4 py-3 dark:bg-gray-800/50">
          <p className="text-sm font-medium text-heading">{order.ref} · {order.itemName}</p>
          {context.poRef && context.soRef && (
            <p className="text-xs text-muted mt-1">{shortLabel} vs {order.side === 'sale' ? context.poRef : context.soRef}</p>
          )}
        </div>

        {!context.ok ? (
          <p className="text-sm text-warning">{context.reason}</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-muted">Delivered</dt>
                <dd className="font-semibold tabular-nums text-heading">{formatQty(order.liftedQty)} MT</dd>
              </div>
              <div>
                <dt className="text-muted">Ordered</dt>
                <dd className="font-semibold tabular-nums text-heading">{formatQty(order.orderQty)} MT</dd>
              </div>
              {context.toBeLifted > 0 && (
                <div>
                  <dt className="text-muted">To be lifted</dt>
                  <dd className="font-semibold tabular-nums text-warning">{formatQty(context.toBeLifted)} MT</dd>
                </div>
              )}
              {context.balanceOwed > 0 && (
                <div>
                  <dt className="text-muted">Balance owed</dt>
                  <dd className="font-semibold tabular-nums text-warning">{formatQty(context.balanceOwed)} MT</dd>
                </div>
              )}
            </dl>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">How are you closing this?</p>
              {context.availableMethods.map(m => (
                <label
                  key={m}
                  className="flex cursor-pointer gap-3 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700 has-[:checked]:border-accent has-[:checked]:bg-accent-muted/30"
                >
                  <Radio
                    name="closeMethod"
                    value={m}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-heading">{METHOD_LABELS[m].title}</span>
                    <span className="block text-xs text-muted mt-0.5">{METHOD_LABELS[m].description}</span>
                    {m === 'cash' && closeQty > 0 && (
                      <span className="block text-xs font-medium tabular-nums text-heading mt-1">
                        {formatQty(closeQty)} @ {formatContractRate(order.rate, order.rateBasis, order.ratePerBasis)} = {formatCurrency(closeAmount)}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            {method !== 'short_closed' && (
              <Input
                label="Settlement date"
                type="date"
                value={settledAt}
                onChange={e => setSettledAt(e.target.value)}
              />
            )}

            <Input
              label="Notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Month-end cash settlement"
            />

            {method === 'carried_forward' && context.toBeLifted > 0 && (
              <p className="text-xs text-muted">
                Effective {formatDate(new Date().toISOString())} · {formatQty(context.toBeLifted)}
                will sit as seller balance and can be applied on the next lift
              </p>
            )}
            {method === 'short_closed' && context.toBeLifted > 0 && (
              <p className="text-xs text-muted">
                Effective {formatDate(new Date().toISOString())} · order qty will reduce to {formatQty(order.liftedQty)} MT
              </p>
            )}
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
