import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Radio } from '../ui/Radio'
import type { TradeOrder } from '../../data/mockData'
import { canCloseOrder, type CloseOrderMethod } from '../../lib/orderClosure'
import { contractRateFromOrder, formatContractRate, orderLineAmount } from '../../lib/orderRate'
import { formatCurrency, formatDate, formatQty } from '../../lib/utils'
import { formatOrderRef, formatPoRef, formatSoRef } from '../../lib/tradeRefs'
import { useTradeStore } from '../../store/TradeStore'
import { useToast } from '../../hooks/useToast'
import { DatePicker } from '../ui/DatePicker'

interface CloseOrderModalProps {
  /** One or more orders to close. */
  orders: TradeOrder[]
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

export function CloseOrderModal({ orders, open, onClose, onComplete }: CloseOrderModalProps) {
  const store = useTradeStore()
  const toast = useToast()
  const [method, setMethod] = useState<CloseOrderMethod>('cash')
  const [notes, setNotes] = useState('')
  const [settledAt, setSettledAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const assessments = useMemo(
    () =>
      orders.map(order => ({
        order,
        context: canCloseOrder(order, store.lifts, store.balanceSettlements ?? [], store.tradeOrders),
      })),
    [orders, store.lifts, store.balanceSettlements, store.tradeOrders],
  )

  const closable = useMemo(() => assessments.filter(a => a.context.ok), [assessments])
  const blocked = useMemo(() => assessments.filter(a => !a.context.ok), [assessments])
  const isBulk = orders.length > 1
  const single = !isBulk && assessments[0] ? assessments[0] : null

  const availableMethods = useMemo(() => {
    if (closable.length === 0) return [] as CloseOrderMethod[]
    const first = new Set(closable[0].context.availableMethods)
    return closable[0].context.availableMethods.filter(m =>
      closable.every(a => a.context.availableMethods.includes(m) && first.has(m)),
    )
  }, [closable])

  const bulkCloseQty = useMemo(
    () => closable.reduce((sum, a) => sum + a.context.balanceOwed + a.context.toBeLifted, 0),
    [closable],
  )

  const availableMethodsKey = availableMethods.join(',')
  const orderIdsKey = orders.map(o => o.id).join(',')

  useEffect(() => {
    if (!open || closable.length === 0) return
    setMethod((availableMethodsKey.split(',')[0] as CloseOrderMethod) || 'cash')
    setNotes('')
    setSettledAt(new Date().toISOString().slice(0, 10))
    setError('')
  }, [open, orderIdsKey, availableMethodsKey, closable.length])

  if (orders.length === 0) return null

  const shortLabel = orders[0]?.side === 'purchase' ? 'PO' : 'SO'

  const handleSubmit = async () => {
    setError('')
    if (closable.length === 0) {
      setError('None of the selected orders can be closed.')
      return
    }
    if (!availableMethods.includes(method)) {
      setError('Choose a valid close method.')
      return
    }

    setSaving(true)
    let closed = 0
    const failures: string[] = []
    try {
      for (const { order } of closable) {
        try {
          await store.closeOrder(order.id, {
            method,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
            ...(method !== 'short_closed' ? { settledAt } : {}),
          })
          closed += 1
        } catch (err) {
          failures.push(
            `${formatOrderRef(order.ref, order.side)}: ${err instanceof Error ? err.message : 'Failed'}`,
          )
        }
      }

      const methodTitle = METHOD_LABELS[method].title
      if (closed > 0 && failures.length === 0) {
        toast.success(closed === 1 ? 'Order closed' : `${closed} orders closed`, {
          description:
            closed === 1
              ? `${formatOrderRef(closable[0].order.ref, closable[0].order.side)} · ${methodTitle}`
              : `${methodTitle}${blocked.length > 0 ? ` · ${blocked.length} skipped` : ''}`,
        })
        onComplete?.()
        onClose()
      } else if (closed > 0) {
        toast.success(`${closed} closed, ${failures.length} failed`, {
          description: failures[0],
        })
        onComplete?.()
        onClose()
      } else {
        setError(failures[0] ?? 'Could not close orders.')
        toast.error('Could not close orders', { description: failures[0] })
      }
    } finally {
      setSaving(false)
    }
  }

  const title = isBulk ? `Close ${orders.length} ${shortLabel}s` : 'Close order'
  const canSubmit = closable.length > 0 && availableMethods.includes(method)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} loading={saving} disabled={saving || !canSubmit}>
            {isBulk ? `Close ${closable.length}` : 'Close order'}
          </Button>
        </div>
      )}
    >
      <div className="space-y-5 py-1">
        {single ? (
          <div className="rounded-md bg-gray-100/90 px-4 py-3 dark:bg-gray-800/50">
            <p className="text-sm font-medium text-heading">
              {formatOrderRef(single.order.ref, single.order.side)} · {single.order.itemName}
            </p>
            {single.context.poRef && single.context.soRef && (
              <p className="text-xs text-muted mt-1">
                {shortLabel} vs{' '}
                {single.order.side === 'sale'
                  ? formatPoRef(single.context.poRef)
                  : formatSoRef(single.context.soRef)}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-md bg-gray-100/90 px-4 py-3 dark:bg-gray-800/50 space-y-1.5">
            <p className="text-sm font-medium text-heading">
              {closable.length} of {orders.length} can be closed
            </p>
            {blocked.length > 0 && (
              <ul className="text-xs text-muted space-y-1 max-h-28 overflow-y-auto">
                {blocked.map(({ order, context }) => (
                  <li key={order.id}>
                    <span className="font-medium text-heading">
                      {formatOrderRef(order.ref, order.side)}
                    </span>
                    {' — '}
                    {context.reason ?? 'Cannot close'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {closable.length === 0 ? (
          <p className="text-sm text-warning">
            {single?.context.reason ?? 'None of the selected orders can be closed.'}
          </p>
        ) : (
          <>
            {single ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted">Delivered</dt>
                  <dd className="font-semibold tabular-nums text-heading">
                    {formatQty(single.order.liftedQty)} MT
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Ordered</dt>
                  <dd className="font-semibold tabular-nums text-heading">
                    {formatQty(single.order.orderQty)} MT
                  </dd>
                </div>
                {single.context.toBeLifted > 0 && (
                  <div>
                    <dt className="text-muted">To be lifted</dt>
                    <dd className="font-semibold tabular-nums text-warning">
                      {formatQty(single.context.toBeLifted)} MT
                    </dd>
                  </div>
                )}
                {single.context.balanceOwed > 0 && (
                  <div>
                    <dt className="text-muted">Balance owed</dt>
                    <dd className="font-semibold tabular-nums text-warning">
                      {formatQty(single.context.balanceOwed)} MT
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted">Closing</dt>
                  <dd className="font-semibold tabular-nums text-heading">
                    {closable.length} {shortLabel}
                    {closable.length === 1 ? '' : 's'}
                  </dd>
                </div>
                {bulkCloseQty > 0 && (
                  <div>
                    <dt className="text-muted">Qty to settle</dt>
                    <dd className="font-semibold tabular-nums text-warning">
                      {formatQty(bulkCloseQty)} MT
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">How are you closing this?</p>
              {availableMethods.map(m => {
                const cashLine =
                  m === 'cash' && single
                    ? (() => {
                        const closeQty = single.context.balanceOwed + single.context.toBeLifted
                        const contractRate = contractRateFromOrder(
                          single.order.rate,
                          single.order.rateBasis,
                          single.order.ratePerBasis,
                        )
                        const closeAmount = orderLineAmount(
                          closeQty,
                          contractRate,
                          single.order.rateBasis,
                        )
                        return closeQty > 0 ? (
                          <span className="block text-xs font-medium tabular-nums text-heading mt-1">
                            {formatQty(closeQty)} @{' '}
                            {formatContractRate(
                              single.order.rate,
                              single.order.rateBasis,
                              single.order.ratePerBasis,
                            )}{' '}
                            = {formatCurrency(closeAmount)}
                          </span>
                        ) : null
                      })()
                    : m === 'cash' && isBulk && bulkCloseQty > 0
                      ? (
                          <span className="block text-xs font-medium tabular-nums text-heading mt-1">
                            {formatQty(bulkCloseQty)} MT across {closable.length} orders
                          </span>
                        )
                      : null
                return (
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
                      {cashLine}
                    </span>
                  </label>
                )
              })}
            </div>

            {method !== 'short_closed' && (
              <DatePicker
                label="Settlement date"
                value={settledAt}
                onChange={setSettledAt}
              />
            )}

            <Input
              label="Notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Month-end cash settlement"
            />

            {method === 'carried_forward' && single && single.context.toBeLifted > 0 && (
              <p className="text-xs text-muted">
                Effective {formatDate(new Date().toISOString())} · {formatQty(single.context.toBeLifted)}
                will sit as seller balance and can be applied on the next lift
              </p>
            )}
            {method === 'short_closed' && single && single.context.toBeLifted > 0 && (
              <p className="text-xs text-muted">
                Effective {formatDate(new Date().toISOString())} · order qty will reduce to{' '}
                {formatQty(single.order.liftedQty)} MT
              </p>
            )}
            {isBulk && (
              <p className="text-xs text-muted">
                The same close method will be applied to each closable {shortLabel}.
              </p>
            )}
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
