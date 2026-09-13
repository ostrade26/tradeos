import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { QtyInput } from '../ui/QtyInput'
import { FormErrorBanner, FieldValidationBanner } from '../ui/FieldError'
import { type Lift } from '../../data/mockData'
import {
  formToLiftTanker,
  getLiftTankers,
  liftTankerToForm,
  sanitizeQtyInput,
  formatTankerNo,
  totalActualQtyFromForm,
  collectLiftTankerFieldErrors,
  type LiftTankerFieldErrorMap,
  type LiftTankerFormValues,
} from '../../lib/liftTankers'
import {
  applyAllocationActuals,
  collectAllocationActualFieldErrors,
  formatLiftSoRefs,
  getLiftAllocations,
} from '../../lib/liftAllocations'
import { formatLiftRef } from '../../lib/tradeRefs'
import { getLiftPlannedQty } from '../../lib/liftBalance'
import {
  LiftSoActualQtyForm,
  actualQtyDraftFromAllocations,
  parsedActualQtyDraft,
  totalActualFromDraft,
} from './LiftSoActualQtyForm'
import { useTradeStore } from '../../store/TradeStore'
import { useToast } from '../../hooks/useToast'
import { formatQty } from '../../lib/utils'
import { DeliveryQtySummary } from './DeliveryQtySummary'

interface BulkMarkLiftsDeliveredModalProps {
  lifts: Lift[]
  open: boolean
  onClose: () => void
  onDelivered?: (lifts: Lift[]) => void
}

function buildTankerForms(lifts: Lift[]): Record<string, LiftTankerFormValues[]> {
  return Object.fromEntries(
    lifts.map(lift => [lift.id, getLiftTankers(lift).map(liftTankerToForm)]),
  )
}

function buildSoActuals(lifts: Lift[]): Record<string, Record<string, string>> {
  return Object.fromEntries(
    lifts.map(lift => [lift.id, actualQtyDraftFromAllocations(getLiftAllocations(lift))]),
  )
}

function BulkLiftTankerFields({
  tankers,
  hideQty,
  hideTotal = false,
  fieldErrors,
  onChange,
}: {
  tankers: LiftTankerFormValues[]
  hideQty: boolean
  hideTotal?: boolean
  fieldErrors?: LiftTankerFieldErrorMap
  onChange: (tankers: LiftTankerFormValues[]) => void
}) {
  const totalActual = totalActualQtyFromForm(tankers)

  const updateTanker = (index: number, patch: Partial<LiftTankerFormValues>) => {
    onChange(tankers.map((t, i) => (i === index ? { ...t, ...patch } : t)))
  }

  return (
    <div className="space-y-3">
      {tankers.map((tanker, index) => (
        <div key={index} className="space-y-2">
          {tankers.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted">Tanker {index + 1}</p>
              <button
                type="button"
                onClick={() => onChange(tankers.filter((_, i) => i !== index))}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors"
                aria-label={`Remove tanker ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Tanker No. (optional)"
              value={tanker.tankerNo}
              error={fieldErrors?.[index]?.tankerNo}
              onChange={e => updateTanker(index, { tankerNo: formatTankerNo(e.target.value) })}
              className="uppercase font-mono"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. MH-12-RF-4236"
            />
            {!hideQty && (
              <QtyInput
                label="Actual weight (MT)"
                value={tanker.actualQty}
                error={fieldErrors?.[index]?.actualQty}
                onChange={e => updateTanker(index, { actualQty: sanitizeQtyInput(e.target.value) })}
                className="tabular-nums"
                placeholder="e.g. 49.740"
              />
            )}
          </div>
        </div>
      ))}

      {!hideQty && !hideTotal && (
        <p className="text-sm font-semibold tabular-nums text-heading">
          Actual quantity: {formatQty(totalActual)}
        </p>
      )}
    </div>
  )
}

export function BulkMarkLiftsDeliveredModal({
  lifts,
  open,
  onClose,
  onDelivered,
}: BulkMarkLiftsDeliveredModalProps) {
  const store = useTradeStore()
  const toast = useToast()
  const [forms, setForms] = useState<Record<string, LiftTankerFormValues[]>>(() => buildTankerForms(lifts))
  const [soActuals, setSoActuals] = useState<Record<string, Record<string, string>>>(() => buildSoActuals(lifts))
  const [deliveredDate, setDeliveredDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [salesInvoiceNos, setSalesInvoiceNos] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [tankerFieldErrors, setTankerFieldErrors] = useState<Record<string, LiftTankerFieldErrorMap>>({})
  const [soFieldErrors, setSoFieldErrors] = useState<Record<string, Record<string, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  const sortedLifts = useMemo(
    () => [...lifts].sort((a, b) => a.liftRef - b.liftRef),
    [lifts],
  )

  useEffect(() => {
    if (!open) return
    setForms(buildTankerForms(lifts))
    setSoActuals(buildSoActuals(lifts))
    setDeliveredDate(new Date().toISOString().slice(0, 10))
    setSalesInvoiceNos({})
    setError('')
    setTankerFieldErrors({})
    setSoFieldErrors({})
    setSubmitting(false)
  }, [open, lifts])

  if (lifts.length === 0) return null

  const updateLiftForm = (liftId: string, tankers: LiftTankerFormValues[]) => {
    setForms(prev => ({ ...prev, [liftId]: tankers }))
  }

  const handleConfirm = async () => {
    if (submitting) return
    setError('')
    setTankerFieldErrors({})
    setSoFieldErrors({})
    for (const lift of sortedLifts) {
      const tankers = forms[lift.id] ?? []
      const hideQty = tankers.length === 1
      const tankerValidation = collectLiftTankerFieldErrors(tankers, 'actual', {
        qtyRequired: !hideQty,
        tankerNoRequired: false,
        requireRow: false,
      })
      if (tankerValidation.message) {
        setTankerFieldErrors({ [lift.id]: tankerValidation.fields })
        return
      }
      if (hideQty) {
        const allocations = getLiftAllocations(lift)
        const actualBySo = parsedActualQtyDraft(soActuals[lift.id] ?? {})
        const allocValidation = collectAllocationActualFieldErrors(allocations, actualBySo)
        if (allocValidation.message) {
          setSoFieldErrors({ [lift.id]: allocValidation.fields })
          return
        }
      }
    }

    setSubmitting(true)
    const deliveredAt = new Date(`${deliveredDate}T12:00:00`).toISOString()
    const delivered: Lift[] = []
    const failures: string[] = []

    for (const lift of sortedLifts) {
      const planned = getLiftTankers(lift)
      const submitted = forms[lift.id] ?? []
      const allocations = getLiftAllocations(lift)
      const hideQty = submitted.length === 1
      try {
        const payload: Parameters<typeof store.markLiftDelivered>[1] = {
          tankers: submitted.map((form, index) => {
            const base = formToLiftTanker(form)
            const plannedTanker = planned[index]
            return {
              ...base,
              transportName: plannedTanker?.transportName ?? base.transportName,
              driverMobile: plannedTanker?.driverMobile ?? base.driverMobile,
              lrNo: plannedTanker?.lrNo ?? base.lrNo,
            }
          }),
          deliveredAt,
          ...(salesInvoiceNos[lift.id]?.trim() ? { salesInvoiceNo: salesInvoiceNos[lift.id].trim() } : {}),
        }
        if (hideQty) {
          const actualBySo = parsedActualQtyDraft(soActuals[lift.id] ?? {})
          const allocValidation = collectAllocationActualFieldErrors(allocations, actualBySo)
          if (allocValidation.message) {
            failures.push(`${formatLiftRef(lift.liftRef)}: ${allocValidation.message}`)
            continue
          }
          payload.allocations = applyAllocationActuals(allocations, actualBySo)
        }
        const updated = await store.markLiftDelivered(lift.id, payload)
        delivered.push(updated)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not mark as delivered'
        failures.push(`${formatLiftRef(lift.liftRef)}: ${message}`)
      }
    }

    setSubmitting(false)

    if (delivered.length > 0) {
      const totalActual = delivered.reduce((sum, lift) => {
        const tankers = forms[lift.id] ?? []
        if (tankers.length === 1) {
          const draft = soActuals[lift.id]
          return sum + (draft ? totalActualFromDraft(draft) : lift.liftedQty)
        }
        return sum + totalActualQtyFromForm(tankers)
      }, 0)
      toast.success(
        delivered.length === 1
          ? `${formatLiftRef(delivered[0].liftRef)} marked delivered`
          : `${delivered.length} lifts marked delivered`,
        { description: `${formatQty(totalActual)} · invoices generated` },
      )
      onDelivered?.(delivered)
    }

    if (failures.length > 0) {
      setError(failures.join(' · '))
      toast.error(
        failures.length === sortedLifts.length ? 'Could not mark lifts as delivered' : 'Some lifts could not be delivered',
        { description: failures.slice(0, 2).join(' · ') },
      )
      return
    }

    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mark ${lifts.length} lift${lifts.length === 1 ? '' : 's'} as delivered`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={() => void handleConfirm()} loading={submitting} disabled={submitting}>
            {`Confirm ${lifts.length} deliver${lifts.length === 1 ? 'y' : 'ies'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {(Object.keys(tankerFieldErrors).length > 0 || Object.keys(soFieldErrors).length > 0) && (
          <FieldValidationBanner />
        )}

        <div className="sm:max-w-xs">
          <Input
            label="Delivery date"
            type="date"
            value={deliveredDate}
            onChange={e => setDeliveredDate(e.target.value)}
          />
        </div>

        <div className="max-h-[min(70vh,40rem)] space-y-4 overflow-y-auto pr-1">
          {sortedLifts.map(lift => {
            const plannedQty = getLiftPlannedQty(lift)
            const allocations = getLiftAllocations(lift)
            const tankers = forms[lift.id] ?? []
            const hideQty = tankers.length === 1
            const actualPreview = hideQty
              ? totalActualFromDraft(soActuals[lift.id] ?? {})
              : totalActualQtyFromForm(tankers)
            const balancePreview = actualPreview > 0 ? Math.max(0, plannedQty - actualPreview) : 0
            return (
            <section
              key={lift.id}
              className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30"
            >
              <div className="mb-3 space-y-2">
                <p className="font-mono text-sm font-medium text-heading">
                  {formatLiftRef(lift.liftRef)} · {formatLiftSoRefs(lift)}
                </p>
                <DeliveryQtySummary
                  planned={plannedQty}
                  actual={actualPreview}
                  balance={balancePreview}
                />
              </div>
              <div className="space-y-4">
                <Input
                  label="Sales invoice no."
                  value={salesInvoiceNos[lift.id] ?? ''}
                  onChange={e => setSalesInvoiceNos(prev => ({ ...prev, [lift.id]: e.target.value }))}
                  className="font-mono uppercase sm:max-w-xs"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Optional"
                />
                {hideQty && (
                  <LiftSoActualQtyForm
                    allocations={allocations}
                    orders={store.tradeOrders}
                    values={soActuals[lift.id] ?? {}}
                    fieldErrors={soFieldErrors[lift.id]}
                    compact
                    hideTotals
                    onChange={next => {
                      setSoFieldErrors(prev => {
                        const nextErrors = { ...prev }
                        delete nextErrors[lift.id]
                        return nextErrors
                      })
                      setSoActuals(prev => ({ ...prev, [lift.id]: next }))
                    }}
                  />
                )}
                <BulkLiftTankerFields
                  tankers={tankers}
                  hideQty={hideQty}
                  hideTotal
                  fieldErrors={tankerFieldErrors[lift.id]}
                  onChange={next => {
                    setTankerFieldErrors(prev => {
                      const nextErrors = { ...prev }
                      delete nextErrors[lift.id]
                      return nextErrors
                    })
                    updateLiftForm(lift.id, next)
                  }}
                />
              </div>
            </section>
            )
          })}
        </div>

        {error && <FormErrorBanner>{error}</FormErrorBanner>}
      </div>
    </Modal>
  )
}
