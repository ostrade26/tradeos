import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
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
import { applyAllocationActuals, collectAllocationActualFieldErrors, formatLiftOrderSummary, getLiftAllocations } from '../../lib/liftAllocations'
import { getLiftPlannedQty, getLiftBalanceQty } from '../../lib/liftBalance'
import { useTradeStore } from '../../store/TradeStore'
import { useToast } from '../../hooks/useToast'
import { formatQty } from '../../lib/utils'
import { formatLiftRef } from '../../lib/tradeRefs'
import { DeliveryQtySummary } from './DeliveryQtySummary'
import { DeliveryFormSection } from './DeliveryFormSection'

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
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [tankerFieldErrors, setTankerFieldErrors] = useState<LiftTankerFieldErrorMap>({})
  const [soFieldErrors, setSoFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open || !lift) return
    setTankers(getLiftTankers(lift).map(liftTankerToForm))
    setSoActuals(actualQtyDraftFromAllocations(getLiftAllocations(lift)))
    setError('')
    setTankerFieldErrors({})
    setSoFieldErrors({})
    setSaving(false)
  }, [open, lift])

  if (!lift) return null

  const allocations = getLiftAllocations(lift)
  /** Per-SO actuals only when one tanker carries multiple orders. */
  const hideTankerQty = tankers.length === 1 && allocations.length > 1
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
      tankerNoRequired: true,
      requireRow: false,
    })
    if (tankerValidation.message) {
      setTankerFieldErrors(tankerValidation.fields)
      return
    }
    try {
      const payload: Parameters<typeof store.markLiftDelivered>[1] = {
        tankers: tankers.map(formToLiftTanker),
        deliveredAt: new Date().toISOString(),
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
      const invoiceHint = updated.salesInvoiceNo?.trim()
        ? updated.salesInvoiceNo.replace(/, /g, ' · ')
        : null
      toast.success(`${formatLiftRef(updated.liftRef)} marked delivered`, {
        description: getLiftBalanceQty(updated) > 0
          ? `${formatQty(actualPreview)} actual · ${formatQty(getLiftBalanceQty(updated))} balance owed${invoiceHint ? ` · ${invoiceHint}` : ''}`
          : `${formatQty(actualPreview)} actual${invoiceHint ? ` · ${invoiceHint}` : ''}`,
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
      title="Confirm delivery"
      subtitle={`${formatLiftRef(lift.liftRef)} · ${lift.itemName} · ${formatLiftOrderSummary(lift)}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleConfirm()} loading={saving} disabled={saving}>Confirm delivery</Button>
        </>
      }
    >
      <div className="space-y-8">
        {(Object.keys(tankerFieldErrors).length > 0 || Object.keys(soFieldErrors).length > 0) && (
          <FieldValidationBanner />
        )}

        <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
          <DeliveryQtySummary
            planned={plannedQty}
            actual={actualPreview}
            balance={balancePreview}
          />
        </div>

        {hideTankerQty && (
          <DeliveryFormSection
            title="Weighed quantity"
            description="Actual MT per sales order."
          >
            <div className="max-w-lg">
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
            </div>
          </DeliveryFormSection>
        )}

        <LiftTankersForm
          tankers={tankers}
          qtyMode="actual"
          hideQty={hideTankerQty}
          hideTotal
          allowAddTanker={false}
          showSalesInvoicePerTanker
          compactDelivery
          deliverySectionPerTanker
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
