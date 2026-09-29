import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { QtyInput } from '../ui/QtyInput'
import { Select } from '../ui/Select'
import { cn, formatQty } from '../../lib/utils'
import { sanitizeQtyInput } from '../../lib/liftTankers'
import { orderDropdownOption } from '../../lib/orderSelectOptions'
import { formatLotRef, formatPoRef, formatSoRef, findTradeOrder, refsMatch } from '../../lib/tradeRefs'
import { remainingOnPoForDispatch, soQtyLeftToLift } from '../../lib/liftAllocations'
import { dispatchPoolForSo, dispatchPoRef, isCrossPoAllocation } from '../../lib/sellerLiftPool'
import { inventoryStockRef, purchaseIsClosed, StockPoLink } from '../registers/StockPoLink'
import { Badge } from '../ui/Badge'
import type { Lift, TradeOrder } from '../../data/mockData'

export type LiftAllocationDraft = {
  id: string
  soRef: string
  poRef: string
  qty: string
}

interface LiftAllocationsFormProps {
  rows: LiftAllocationDraft[]
  onChange: (rows: LiftAllocationDraft[]) => void
  orders: TradeOrder[]
  lifts: Lift[]
  itemFilter: string
  sellerFilter?: string
  excludeLiftId?: string
  disabled?: boolean
}

export function newAllocationDraft(partial?: Partial<LiftAllocationDraft>): LiftAllocationDraft {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    soRef: '',
    poRef: '',
    qty: '',
    ...partial,
  }
}

function soMatchesSellerFilter(so: TradeOrder, sellerFilter: string | undefined, orders: TradeOrder[]): boolean {
  if (!sellerFilter) return true
  const booked = findTradeOrder(orders, 'purchase', dispatchPoRef(so))
  if (booked && (booked.sellerName || booked.partyName) === sellerFilter) return true
  if (so.stockPoRef && !so.poRef) {
    const source = findTradeOrder(orders, 'purchase', so.stockPoRef)
    return Boolean(source && (source.sellerName || source.partyName) === sellerFilter)
  }
  return dispatchPoolForSo(so, orders).some(po => (po.sellerName || po.partyName) === sellerFilter)
}

function qtyOnOtherRows(rows: LiftAllocationDraft[], ref: string, key: 'soRef' | 'poRef', exceptId: string): number {
  return rows.reduce((sum, row) => {
    if (row.id === exceptId || !refsMatch(row[key], ref, key === 'poRef' ? 'purchase' : 'sale')) return sum
    return sum + (parseFloat(row.qty) || 0)
  }, 0)
}

function AvailableQtyCaption({ available, requested, warning }: { available: number; requested: number; warning?: string }) {
  if (warning) {
    return (
      <p className="text-xs text-danger mt-1 leading-relaxed">{warning}</p>
    )
  }
  const enough = available > 0 && (requested <= 0 || available >= requested)
  return (
    <p className={cn(
      'text-xs tabular-nums mt-1',
      enough ? 'text-success' : 'text-danger',
    )}>
      {formatQty(available)} left to lift
    </p>
  )
}

export function LiftAllocationsForm({
  rows,
  onChange,
  orders,
  lifts,
  itemFilter,
  sellerFilter,
  excludeLiftId,
  disabled,
}: LiftAllocationsFormProps) {
  const eligibleSOs = orders.filter(o =>
    o.side === 'sale'
    && o.status !== 'cancelled'
    && o.status !== 'completed'
    && (!itemFilter || o.itemName === itemFilter)
    && soMatchesSellerFilter(o, sellerFilter, orders),
  )

  const updateRow = (id: string, patch: Partial<LiftAllocationDraft>) => {
    onChange(rows.map(row => (row.id === id ? { ...row, ...patch } : row)))
  }

  const setSo = (row: LiftAllocationDraft, soRef: string) => {
    const so = orders.find(o => o.ref === soRef && o.side === 'sale')
    const pool = so ? dispatchPoolForSo(so, orders, row.poRef) : []
    const source = so ? dispatchPoRef(so) : undefined
    const poRef = pool.some(p => p.ref === row.poRef)
      ? row.poRef
      : (pool.find(p => source && refsMatch(p.ref, source, 'purchase')) ?? pool[0])?.ref ?? ''
    const po = orders.find(o => o.ref === poRef && o.side === 'purchase')
    const soAvail = so ? soQtyLeftToLift(so, lifts, excludeLiftId) : { qty: 0 as number | null }
    const soLeft = (soAvail.qty ?? 0) - qtyOnOtherRows(rows, soRef, 'soRef', row.id)
    const poLeft = po ? remainingOnPoForDispatch(po, lifts, excludeLiftId) - qtyOnOtherRows(rows, poRef, 'poRef', row.id) : soLeft
    const qty = Math.max(0, Math.min(soLeft, poLeft || soLeft))
    updateRow(row.id, {
      soRef,
      poRef,
      qty: qty > 0 ? String(qty) : row.qty,
    })
  }

  const setPo = (row: LiftAllocationDraft, poRef: string) => {
    const so = orders.find(o => o.ref === row.soRef && o.side === 'sale')
    const po = orders.find(o => o.ref === poRef && o.side === 'purchase')
    const soAvail = so ? soQtyLeftToLift(so, lifts, excludeLiftId) : { qty: 0 as number | null }
    const soLeft = (soAvail.qty ?? 0) - qtyOnOtherRows(rows, row.soRef, 'soRef', row.id)
    const poLeft = po ? remainingOnPoForDispatch(po, lifts, excludeLiftId) - qtyOnOtherRows(rows, poRef, 'poRef', row.id) : soLeft
    const qty = Math.max(0, Math.min(soLeft, poLeft || soLeft))
    updateRow(row.id, {
      poRef,
      qty: qty > 0 ? String(qty) : row.qty,
    })
  }

  const addRow = () => {
    const used = new Set(rows.map(r => r.soRef).filter(Boolean))
    const next = eligibleSOs.find(s => {
      const avail = soQtyLeftToLift(s, lifts, excludeLiftId)
      return !used.has(s.ref) && (avail.qty ?? 0) > 0
    })
    if (!next) {
      onChange([...rows, newAllocationDraft()])
      return
    }
    const source = dispatchPoRef(next)
    const pool = dispatchPoolForSo(next, orders)
      .filter(p => p.status !== 'completed' || (source && refsMatch(p.ref, source, 'purchase')))
      .filter(p => remainingOnPoForDispatch(p, lifts, excludeLiftId) > 0 || (source && refsMatch(p.ref, source, 'purchase')))
    const po = pool.find(p => source && refsMatch(p.ref, source, 'purchase')) ?? pool[0]
    const soLeft = soQtyLeftToLift(next, lifts, excludeLiftId).qty ?? 0
    const poLeft = po
      ? remainingOnPoForDispatch(po, lifts, excludeLiftId) - qtyOnOtherRows(rows, po.ref, 'poRef', '')
      : soLeft
    onChange([...rows, newAllocationDraft({
      soRef: next.ref,
      poRef: po?.ref ?? '',
      qty: String(Math.max(0, Math.min(soLeft, poLeft || soLeft))),
    })])
  }

  const removeRow = (id: string) => {
    if (rows.length <= 1) return
    onChange(rows.filter(r => r.id !== id))
  }

  const total = rows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Orders on this tanker</h3>
        <p className="text-sm font-semibold tabular-nums shrink-0">{formatQty(total)}</p>
      </div>

      <div className="space-y-4 [&>*+*]:border-t [&>*+*]:border-gray-100 [&>*+*]:pt-4 dark:[&>*+*]:border-gray-800">
        {rows.map((row, index) => {
          const so = orders.find(o => o.ref === row.soRef && o.side === 'sale')
          const usedSos = new Set(rows.filter(r => r.id !== row.id).map(r => r.soRef).filter(Boolean))
          const soOptions = (() => {
            const opts = eligibleSOs.filter(s => {
              if (usedSos.has(s.ref) && s.ref !== row.soRef) return false
              return true
            })
            // Keep a currently selected SO visible when editing (even if completed).
            if (row.soRef && !opts.some(s => s.ref === row.soRef)) {
              const currentSo = orders.find(o => o.ref === row.soRef && o.side === 'sale' && o.status !== 'cancelled')
              if (currentSo) opts.unshift(currentSo)
            }
            return opts
          })()
          const sourcePo = findTradeOrder(orders, 'purchase', so?.stockPoRef || so?.poRef || row.poRef)
          const stockRef = inventoryStockRef(so, sourcePo)
            ?? (!so && sourcePo && purchaseIsClosed(sourcePo) && refsMatch(sourcePo.ref, row.poRef, 'purchase')
              ? row.poRef
              : undefined)
          const poPool = (() => {
            const pool = so ? dispatchPoolForSo(so, orders, row.poRef) : []
            if (row.poRef && !pool.some(p => p.ref === row.poRef)) {
              const currentPo = orders.find(o => o.ref === row.poRef && o.side === 'purchase' && o.status !== 'cancelled')
              if (currentPo) pool.unshift(currentPo)
            }
            return pool
          })()
          const soAvail = so ? soQtyLeftToLift(so, lifts, excludeLiftId) : { qty: 0 as number | null }
          const soLeft = (soAvail.qty ?? 0) - qtyOnOtherRows(rows, row.soRef, 'soRef', row.id)
          const poLeft = row.poRef && !stockRef
            ? (() => {
              const po = orders.find(o => o.ref === row.poRef && o.side === 'purchase')
              return po
                ? remainingOnPoForDispatch(po, lifts, excludeLiftId) - qtyOnOtherRows(rows, row.poRef, 'poRef', row.id)
                : 0
            })()
            : soLeft
          const maxQty = Math.max(0, Math.min(soLeft, poLeft || soLeft))
          const rowQty = parseFloat(row.qty) || 0
          const maxQtyMessage = rowQty > maxQty && rowQty > 0
            ? rowQty > soLeft && row.soRef
              ? `${formatSoRef(row.soRef)} only has ${formatQty(soLeft)} left to lift`
              : rowQty > poLeft && row.poRef && !stockRef
                ? `${formatPoRef(row.poRef)} only has ${formatQty(poLeft)} left to lift`
                : undefined
            : undefined

          return (
            <div key={row.id} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold text-heading">
                    SO {index + 1}
                  </p>
                  {so && row.poRef && !stockRef && isCrossPoAllocation(so, row.poRef) && (
                    <Badge variant="warning">Cross lot</Badge>
                  )}
                </div>
                {rows.length > 1 && !disabled && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors"
                    aria-label={`Remove SO ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Select
                    label="Sales Order"
                    options={soOptions.length > 0
                      ? soOptions.map(s => {
                        const avail = soQtyLeftToLift(s, lifts, excludeLiftId)
                        const qty = avail.qty == null
                          ? null
                          : Math.max(0, avail.qty - qtyOnOtherRows(rows, s.ref, 'soRef', row.id))
                        const bookedPo = findTradeOrder(orders, 'purchase', s.poRef || s.stockPoRef)
                        const stock = inventoryStockRef(s, bookedPo)
                        const sourceLabel = stock
                          ? `Godown ${formatLotRef(stock)}`
                          : s.poRef
                            ? `Purchase ${formatPoRef(s.poRef)}`
                            : 'Not linked'
                        const option = orderDropdownOption(s, qty, [sourceLabel])
                        return {
                          ...option,
                          group: stock ? 'godown' : 'contract',
                          label: `${formatSoRef(s.ref)} — ${sourceLabel} · ${s.partyName}`,
                        }
                      })
                      : [{ value: '', label: itemFilter ? `No SO for ${itemFilter}` : 'No SO available' }]}
                    value={row.soRef}
                    displayLabel={so ? undefined : (row.soRef || undefined)}
                    onChange={e => setSo(row, e.target.value)}
                    disabled={disabled}
                    emptyMessage={itemFilter ? `No SO for ${itemFilter}` : 'No sales orders in this tab'}
                    groups={[
                      { id: 'contract', label: 'Contract SO' },
                      { id: 'godown', label: 'Godown SO' },
                    ]}
                    listMaxHeight={420}
                  />
                  {so && (
                    <AvailableQtyCaption available={soLeft} requested={rowQty} warning={soAvail.warning} />
                  )}
                </div>
                <div>
                  {stockRef ? (
                    <>
                      <p className="text-xs font-medium text-muted mb-1.5">Lot</p>
                      <StockPoLink poRef={stockRef} />
                    </>
                  ) : (
                    <>
                      <Select
                        label="Purchase Order (Lot)"
                        options={poPool.length > 0
                          ? poPool.map(p => {
                            const booked = so?.poRef === p.ref
                            return orderDropdownOption(
                              p,
                              Math.max(0, remainingOnPoForDispatch(p, lifts, excludeLiftId) - qtyOnOtherRows(rows, p.ref, 'poRef', row.id)),
                              booked || !so?.poRef ? [] : ['same seller'],
                            )
                          })
                          : [{ value: '', label: 'Select an SO first' }]}
                        value={row.poRef}
                        onChange={e => setPo(row, e.target.value)}
                        disabled={disabled || !row.soRef}
                      />
                      {row.poRef && (
                        <AvailableQtyCaption available={poLeft} requested={rowQty} />
                      )}
                      {so && row.poRef && !stockRef && isCrossPoAllocation(so, row.poRef) && (
                        <p className="text-xs text-warning mt-1.5 leading-relaxed">
                          Booked on {formatPoRef(so.poRef ?? '')} · dispatching from {formatPoRef(row.poRef)} (buyer-first delivery)
                        </p>
                      )}
                    </>
                  )}
                </div>
                <QtyInput
                  label="Qty on this tanker (MT)"
                  value={row.qty}
                  maxQty={maxQty > 0 ? maxQty : undefined}
                  maxQtyMessage={maxQtyMessage}
                  onChange={e => updateRow(row.id, { qty: sanitizeQtyInput(e.target.value) })}
                  disabled={disabled}
                  placeholder={maxQty > 0 ? `Up to ${formatQty(maxQty)}` : '0'}
                />
              </div>
            </div>
          )
        })}
      </div>

      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4" />
          Add SO
        </Button>
      )}
    </div>
  )
}
