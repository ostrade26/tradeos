import { useEffect, useMemo, useState } from 'react'
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
  type LiftTankerFormValues,
} from '../../lib/liftTankers'
import { applyAllocationActuals, collectAllocationActualFieldErrors, formatLiftOrderSummary, getLiftAllocations } from '../../lib/liftAllocations'
import { getLiftPlannedQty, getLiftBalanceQty } from '../../lib/liftBalance'
import { useTradeStore } from '../../store/TradeStore'
import { useToast } from '../../hooks/useToast'
import { formatQty } from '../../lib/utils'
import { formatLiftRef } from '../../lib/tradeRefs'
import { DeliveryQtySummary } from './DeliveryQtySummary'
import { DeliveryFormSection } from './DeliveryFormSection'

interface LiftDeliveryDraft {
  tankers: LiftTankerFormValues[]
  soActuals: Record<string, string>
  tankerFieldErrors: LiftTankerFieldErrorMap
  soFieldErrors: Record<string, string>
}

function draftFromLift(lift: Lift): LiftDeliveryDraft {
  return {
    tankers: getLiftTankers(lift).map(liftTankerToForm),
    soActuals: actualQtyDraftFromAllocations(getLiftAllocations(lift)),
    tankerFieldErrors: {},
    soFieldErrors: {},
  }
}

function draftsFromLifts(lifts: Lift[]): Record<string, LiftDeliveryDraft> {
  return Object.fromEntries(lifts.map(lift => [lift.id, draftFromLift(lift)]))
}

interface MarkLiftDeliveredModalProps {
  lift?: Lift | null
  lifts?: Lift[]
  open: boolean
  onClose: () => void
  onDelivered?: (lift: Lift) => void
  onDeliveredAll?: (lifts: Lift[]) => void
}

export function MarkLiftDeliveredModal({
  lift,
  lifts,
  open,
  onClose,
  onDelivered,
  onDeliveredAll,
}: MarkLiftDeliveredModalProps) {
  const store = useTradeStore()
  const toast = useToast()
  const targets = useMemo(() => {
    if (lifts && lifts.length > 0) return lifts
    return lift ? [lift] : []
  }, [lift, lifts])
  const targetKey = targets.map(l => l.id).join('|')

  const [drafts, setDrafts] = useState<Record<string, LiftDeliveryDraft>>(() => draftsFromLifts(targets))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || targets.length === 0) return
    setDrafts(draftsFromLifts(targets))
    setError('')
    setSaving(false)
  }, [open, targetKey])

  if (targets.length === 0) return null

  const hasFieldErrors = targets.some(l => {
    const draft = drafts[l.id]
    if (!draft) return false
    return Object.keys(draft.tankerFieldErrors).length > 0 || Object.keys(draft.soFieldErrors).length > 0
  })

  const patchDraft = (liftId: string, patch: Partial<LiftDeliveryDraft>) => {
    setDrafts(prev => {
      const current = prev[liftId]
      if (!current) return prev
      return { ...prev, [liftId]: { ...current, ...patch } }
    })
  }

  const handleConfirm = async () => {
    if (saving) return
    setError('')
    setDrafts(prev => {
      const next = { ...prev }
      for (const l of targets) {
        const d = next[l.id]
        if (d) next[l.id] = { ...d, tankerFieldErrors: {}, soFieldErrors: {} }
      }
      return next
    })

    const payloads: { lift: Lift; payload: Parameters<typeof store.markLiftDelivered>[1]; actualPreview: number }[] = []

    for (const current of targets) {
      const draft = drafts[current.id] ?? draftFromLift(current)
      const allocations = getLiftAllocations(current)
      const hideTankerQty = draft.tankers.length === 1 && allocations.length > 1
      const tankerValidation = collectLiftTankerFieldErrors(draft.tankers, 'actual', {
        qtyRequired: !hideTankerQty,
        tankerNoRequired: true,
        requireRow: false,
      })
      if (tankerValidation.message) {
        patchDraft(current.id, { tankerFieldErrors: tankerValidation.fields })
        return
      }
      const payload: Parameters<typeof store.markLiftDelivered>[1] = {
        tankers: draft.tankers.map(formToLiftTanker),
        deliveredAt: new Date().toISOString(),
      }
      const actualPreview = hideTankerQty
        ? totalActualFromDraft(draft.soActuals)
        : totalActualQtyFromForm(draft.tankers)
      if (hideTankerQty) {
        const actualBySo = parsedActualQtyDraft(draft.soActuals)
        const allocValidation = collectAllocationActualFieldErrors(allocations, actualBySo)
        if (allocValidation.message) {
          patchDraft(current.id, { soFieldErrors: allocValidation.fields })
          return
        }
        payload.allocations = applyAllocationActuals(allocations, actualBySo)
      }
      payloads.push({ lift: current, payload, actualPreview })
    }

    setSaving(true)
    const delivered: Lift[] = []
    try {
      for (const item of payloads) {
        const updated = await store.markLiftDelivered(item.lift.id, item.payload)
        delivered.push(updated)
        onDelivered?.(updated)
        if (payloads.length === 1) {
          const invoiceHint = updated.salesInvoiceNo?.trim()
            ? updated.salesInvoiceNo.replace(/, /g, ' · ')
            : null
          toast.success(`${formatLiftRef(updated.liftRef)} marked delivered`, {
            description: getLiftBalanceQty(updated) > 0
              ? `${formatQty(item.actualPreview)} actual · ${formatQty(getLiftBalanceQty(updated))} balance owed${invoiceHint ? ` · ${invoiceHint}` : ''}`
              : `${formatQty(item.actualPreview)} actual${invoiceHint ? ` · ${invoiceHint}` : ''}`,
          })
        }
      }
      if (payloads.length > 1) {
        toast.success(`${delivered.length} lifts marked delivered`)
      }
      onDeliveredAll?.(delivered)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not mark lift as delivered'
      setError(message)
      toast.error('Could not mark lift as delivered', { description: message })
    } finally {
      setSaving(false)
    }
  }

  const multi = targets.length > 1
  const first = targets[0]
  const title = 'Confirm delivery'
  const subtitle = multi
    ? `${targets.length} lifts`
    : `${formatLiftRef(first.liftRef)} · ${first.itemName} · ${formatLiftOrderSummary(first, store.tradeOrders)}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleConfirm()} loading={saving} disabled={saving}>Confirm delivery</Button>
        </>
      }
    >
      <div className="space-y-8">
        {hasFieldErrors && <FieldValidationBanner />}

        {targets.map((current, index) => {
          const draft = drafts[current.id] ?? draftFromLift(current)
          const allocations = getLiftAllocations(current)
          const hideTankerQty = draft.tankers.length === 1 && allocations.length > 1
          const plannedQty = getLiftPlannedQty(current)
          const actualPreview = hideTankerQty
            ? totalActualFromDraft(draft.soActuals)
            : totalActualQtyFromForm(draft.tankers)
          const balancePreview = actualPreview > 0 ? Math.max(0, plannedQty - actualPreview) : 0
          return (
            <div
              key={current.id}
              className={multi && index < targets.length - 1 ? 'space-y-8 pb-8 border-b border-gray-200 dark:border-gray-700' : 'space-y-8'}
            >
              {multi && (
                <p className="text-sm font-semibold text-heading">
                  {formatLiftRef(current.liftRef)}
                  <span className="font-normal text-muted"> · {current.itemName} · {formatLiftOrderSummary(current, store.tradeOrders)}</span>
                </p>
              )}

              <div className={multi ? '' : 'pb-6 border-b border-gray-200 dark:border-gray-700'}>
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
                      values={draft.soActuals}
                      fieldErrors={draft.soFieldErrors}
                      compact
                      hideTotals
                      onChange={values => {
                        patchDraft(current.id, { soFieldErrors: {}, soActuals: values })
                      }}
                    />
                  </div>
                </DeliveryFormSection>
              )}

              <LiftTankersForm
                tankers={draft.tankers}
                qtyMode="actual"
                hideQty={hideTankerQty}
                hideTotal
                allowAddTanker={false}
                showSalesInvoicePerTanker
                compactDelivery
                deliverySectionPerTanker
                fieldErrors={draft.tankerFieldErrors}
                onChange={next => {
                  patchDraft(current.id, { tankerFieldErrors: {}, tankers: next })
                }}
              />
            </div>
          )
        })}

        {error && <FormErrorBanner>{error}</FormErrorBanner>}
      </div>
    </Modal>
  )
}
