import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { QtyInput } from '../ui/QtyInput'
import { Select } from '../ui/Select'
import { cn, formatQty } from '../../lib/utils'
import { sanitizeQtyInput } from '../../lib/liftTankers'
import { orderDropdownOption } from '../../lib/orderSelectOptions'
import { remainingOnOrder } from '../../lib/liftAllocations'
import { poolPOsForSo, isCrossPoAllocation } from '../../lib/sellerLiftPool'
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
  const booked = orders.find(p => p.ref === so.poRef && p.side === 'purchase')
  if (booked && (booked.sellerName || booked.partyName) === sellerFilter) return true
  return poolPOsForSo(so, orders).some(po => (po.sellerName || po.partyName) === sellerFilter)
}

function qtyOnOtherRows(rows: LiftAllocationDraft[], ref: string, key: 'soRef' | 'poRef', exceptId: string): number {
  return rows.reduce((sum, row) => {
    if (row.id === exceptId || row[key] !== ref) return sum
    return sum + (parseFloat(row.qty) || 0)
  }, 0)
}

function AvailableQtyCaption({ available, requested }: { available: number; requested: number }) {
  const enough = available > 0 && (requested <= 0 || available >= requested)
  return (
    <p className={cn(
      'text-xs tabular-nums mt-1',
      enough ? 'text-success' : 'text-danger',
    )}>
      {formatQty(available)} MT available
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
  const pendingSOs = orders.filter(o =>
    o.side === 'sale'
    && o.status !== 'completed'
    && o.status !== 'cancelled'
    && (!itemFilter || o.itemName === itemFilter)
    && soMatchesSellerFilter(o, sellerFilter, orders),
  )

  const updateRow = (id: string, patch: Partial<LiftAllocationDraft>) => {
    onChange(rows.map(row => (row.id === id ? { ...row, ...patch } : row)))
  }

  const setSo = (row: LiftAllocationDraft, soRef: string) => {
    const so = orders.find(o => o.ref === soRef && o.side === 'sale')
    const pool = so ? poolPOsForSo(so, orders) : []
    const poRef = pool.some(p => p.ref === row.poRef)
      ? row.poRef
      : (pool.find(p => p.ref === so?.poRef) ?? pool[0])?.ref ?? ''
    const po = orders.find(o => o.ref === poRef && o.side === 'purchase')
    const soLeft = so ? remainingOnOrder(so, lifts, excludeLiftId) - qtyOnOtherRows(rows, soRef, 'soRef', row.id) : 0
    const poLeft = po ? remainingOnOrder(po, lifts, excludeLiftId) - qtyOnOtherRows(rows, poRef, 'poRef', row.id) : soLeft
    const qty = Math.max(0, Math.min(soLeft, poLeft || soLeft))
    updateRow(row.id, {
      soRef,
      poRef,
      qty: qty > 0 ? String(qty) : '',
    })
  }

  const setPo = (row: LiftAllocationDraft, poRef: string) => {
    const so = orders.find(o => o.ref === row.soRef && o.side === 'sale')
    const po = orders.find(o => o.ref === poRef && o.side === 'purchase')
    const soLeft = so ? remainingOnOrder(so, lifts, excludeLiftId) - qtyOnOtherRows(rows, row.soRef, 'soRef', row.id) : 0
    const poLeft = po ? remainingOnOrder(po, lifts, excludeLiftId) - qtyOnOtherRows(rows, poRef, 'poRef', row.id) : soLeft
    const qty = Math.max(0, Math.min(soLeft, poLeft || soLeft))
    updateRow(row.id, {
      poRef,
      qty: qty > 0 ? String(qty) : row.qty,
    })
  }

  const addRow = () => {
    const used = new Set(rows.map(r => r.soRef).filter(Boolean))
    const next = pendingSOs.find(s => !used.has(s.ref) && remainingOnOrder(s, lifts, excludeLiftId) > 0)
    if (!next) {
      onChange([...rows, newAllocationDraft()])
      return
    }
    const pool = poolPOsForSo(next, orders)
    const po = pool.find(p => p.ref === next.poRef) ?? pool[0]
    const soLeft = remainingOnOrder(next, lifts, excludeLiftId)
    const poLeft = po
      ? remainingOnOrder(po, lifts, excludeLiftId) - qtyOnOtherRows(rows, po.ref, 'poRef', '')
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Orders on this tanker</h3>
        <p className="text-sm font-semibold tabular-nums shrink-0">{formatQty(total)}</p>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => {
          const so = orders.find(o => o.ref === row.soRef && o.side === 'sale')
          const usedSos = new Set(rows.filter(r => r.id !== row.id).map(r => r.soRef).filter(Boolean))
          const soOptions = pendingSOs.filter(s => {
            if (s.ref === row.soRef) return true
            if (usedSos.has(s.ref)) return false
            return remainingOnOrder(s, lifts, excludeLiftId) > 0
          })
          const poPool = so ? poolPOsForSo(so, orders) : []
          const soLeft = so
            ? remainingOnOrder(so, lifts, excludeLiftId) - qtyOnOtherRows(rows, row.soRef, 'soRef', row.id)
            : 0
          const poLeft = row.poRef
            ? (() => {
              const po = orders.find(o => o.ref === row.poRef && o.side === 'purchase')
              return po
                ? remainingOnOrder(po, lifts, excludeLiftId) - qtyOnOtherRows(rows, row.poRef, 'poRef', row.id)
                : 0
            })()
            : soLeft
          const maxQty = Math.max(0, Math.min(soLeft, poLeft || soLeft))
          const rowQty = parseFloat(row.qty) || 0
          const maxQtyMessage = rowQty > maxQty && rowQty > 0
            ? rowQty > soLeft && row.soRef
              ? `${row.soRef} only has ${formatQty(soLeft)} left to lift`
              : rowQty > poLeft && row.poRef
                ? `${row.poRef} only has ${formatQty(poLeft)} left to lift`
                : undefined
            : undefined

          return (
            <div
              key={row.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    SO {index + 1}
                  </p>
                  {so && row.poRef && isCrossPoAllocation(so, row.poRef) && (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Select
                    label="Sales Order"
                    options={soOptions.length > 0
                      ? soOptions.map(s => orderDropdownOption(
                        s,
                        Math.max(0, remainingOnOrder(s, lifts, excludeLiftId) - qtyOnOtherRows(rows, s.ref, 'soRef', row.id)),
                        [s.poRef ? `Lot ${s.poRef}` : 'No PO linked'],
                      ))
                      : [{ value: '', label: itemFilter ? `No pending SO for ${itemFilter}` : 'No pending SO' }]}
                    value={row.soRef}
                    onChange={e => setSo(row, e.target.value)}
                    disabled={disabled}
                  />
                  {so && (
                    <AvailableQtyCaption available={soLeft} requested={rowQty} />
                  )}
                </div>
                <div>
                  <Select
                    label="Purchase Order (Lot)"
                    options={poPool.length > 0
                      ? poPool.map(p => {
                        const booked = so?.poRef === p.ref
                        return orderDropdownOption(
                          p,
                          Math.max(0, remainingOnOrder(p, lifts, excludeLiftId) - qtyOnOtherRows(rows, p.ref, 'poRef', row.id)),
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
                  {so && row.poRef && isCrossPoAllocation(so, row.poRef) && (
                    <p className="text-xs text-warning mt-1.5 leading-relaxed">
                      Booked on {so.poRef} · dispatching from {row.poRef} (buyer-first delivery)
                    </p>
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
