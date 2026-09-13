import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { FormErrorBanner, FieldValidationBanner } from '../ui/FieldError'
import { LiftTankersForm } from './LiftTankersForm'
import {
  LiftSoActualQtyForm,
  actualQtyDraftFromAllocations,
  parsedActualQtyDraft,
  totalActualFromDraft,
} from './LiftSoActualQtyForm'
import { type Lift } from '../../data/mockData'
import {
  formToLiftTanker,
  getLiftTankers,
  liftTankerToForm,
  totalActualQtyFromForm,
  collectLiftTankerFieldErrors,
  type LiftTankerFieldErrorMap,
} from '../../lib/liftTankers'
import { applyAllocationActuals, collectAllocationActualFieldErrors, getLiftAllocations } from '../../lib/liftAllocations'
import { getLiftPlannedQty, getLiftBalanceQty } from '../../lib/liftBalance'
import { useTradeStore } from '../../store/TradeStore'
import { useToast } from '../../hooks/useToast'
import { formatQty } from '../../lib/utils'
import { formatLiftRef } from '../../lib/tradeRefs'
import { DeliveryQtySummary } from './DeliveryQtySummary'

interface MarkLiftDeliveredModalProps {
  lift: Lift | null
  open: boolean
  onClose: () => void
  onDelivered?: (lift: Lift) => void
}

export function MarkLiftDeliveredModal({ lift, open, onClose, onDelivered }: MarkLiftDeliveredModalProps) {
  const store = useTradeStore()
  const toast = useToast()
  const [tankers, setTankers] = useState(() => lift ? getLiftTankers(lift).map(liftTankerToForm) : [])
  const [soActuals, setSoActuals] = useState<Record<string, string>>(() =>
    lift ? actualQtyDraftFromAllocations(getLiftAllocations(lift)) : {},
  )
  const [deliveredDate, setDeliveredDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [salesInvoiceNo, setSalesInvoiceNo] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [tankerFieldErrors, setTankerFieldErrors] = useState<LiftTankerFieldErrorMap>({})
  const [soFieldErrors, setSoFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open || !lift) return
    setTankers(getLiftTankers(lift).map(liftTankerToForm))
    setSoActuals(actualQtyDraftFromAllocations(getLiftAllocations(lift)))
    setDeliveredDate(new Date().toISOString().slice(0, 10))
    setSalesInvoiceNo('')
    setError('')
    setTankerFieldErrors({})
    setSoFieldErrors({})
    setSaving(false)
  }, [open, lift])

  if (!lift) return null

  const allocations = getLiftAllocations(lift)
  const hideTankerQty = tankers.length === 1
  const plannedQty = getLiftPlannedQty(lift)
  const actualPreview = hideTankerQty
    ? totalActualFromDraft(soActuals)
    : totalActualQtyFromForm(tankers)
  const balancePreview = actualPreview > 0 ? Math.max(0, plannedQty - actualPreview) : 0

  const handleConfirm = async () => {
    if (saving) return
    setError('')
    setTankerFieldErrors({})
    setSoFieldErrors({})
    const tankerValidation = collectLiftTankerFieldErrors(tankers, 'actual', {
      qtyRequired: !hideTankerQty,
      tankerNoRequired: false,
      requireRow: false,
    })
    if (tankerValidation.message) {
      setTankerFieldErrors(tankerValidation.fields)
      return
    }
    try {
      const payload: Parameters<typeof store.markLiftDelivered>[1] = {
        tankers: tankers.map(formToLiftTanker),
        deliveredAt: new Date(`${deliveredDate}T12:00:00`).toISOString(),
        ...(salesInvoiceNo.trim() ? { salesInvoiceNo: salesInvoiceNo.trim() } : {}),
      }
      if (hideTankerQty) {
        const actualBySo = parsedActualQtyDraft(soActuals)
        const allocValidation = collectAllocationActualFieldErrors(allocations, actualBySo)
        if (allocValidation.message) {
          setSoFieldErrors(allocValidation.fields)
          return
        }
        payload.allocations = applyAllocationActuals(allocations, actualBySo)
      }
      setSaving(true)
      const updated = await store.markLiftDelivered(lift.id, payload)
      toast.success(`${formatLiftRef(updated.liftRef)} marked delivered`, {
        description: getLiftBalanceQty(updated) > 0
          ? `${formatQty(actualPreview)} actual · ${formatQty(getLiftBalanceQty(updated))} balance owed`
          : `${formatQty(actualPreview)} actual · ${updated.salesInvoiceNo ?? 'Invoice generated'}`,
      })
      onDelivered?.(updated)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not mark lift as delivered'
      setError(message)
      toast.error('Could not mark lift as delivered', { description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mark ${formatLiftRef(lift.liftRef)} as delivered`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleConfirm()} loading={saving} disabled={saving}>Confirm delivery</Button>
        </>
      }
    >
      <div className="space-y-4">
        {(Object.keys(tankerFieldErrors).length > 0 || Object.keys(soFieldErrors).length > 0) && (
          <FieldValidationBanner />
        )}
        <DeliveryQtySummary
          planned={plannedQty}
          actual={actualPreview}
          balance={balancePreview}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Delivery date"
            type="date"
            value={deliveredDate}
            onChange={e => setDeliveredDate(e.target.value)}
          />
          <Input
            label="Sales invoice no."
            value={salesInvoiceNo}
            onChange={e => setSalesInvoiceNo(e.target.value)}
            className="font-mono uppercase"
            autoComplete="off"
            spellCheck={false}
            placeholder="Optional"
          />
        </div>
        {hideTankerQty && (
          <LiftSoActualQtyForm
            allocations={allocations}
            orders={store.tradeOrders}
            values={soActuals}
            fieldErrors={soFieldErrors}
            compact
            hideTotals
            onChange={values => {
              setSoFieldErrors({})
              setSoActuals(values)
            }}
          />
        )}
        <LiftTankersForm
          tankers={tankers}
          qtyMode="actual"
          hideQty={hideTankerQty}
          hideTotal
          tankerNoOptional
          allowAddTanker={false}
          fieldErrors={tankerFieldErrors}
          onChange={next => {
            setTankerFieldErrors({})
            setTankers(next)
          }}
        />
        {error && <FormErrorBanner>{error}</FormErrorBanner>}
      </div>
    </Modal>
  )
}
