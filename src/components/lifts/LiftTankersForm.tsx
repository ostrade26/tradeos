import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { QtyInput } from '../ui/QtyInput'
import {
  type LiftTankerFormValues,
  emptyLiftTankerForm,
  suggestedTankerCount,
  sanitizeQtyInput,
  formatTankerNo,
  totalActualQtyFromForm,
  TANKER_CAPACITY_MT,
  type LiftTankerFieldErrorMap,
} from '../../lib/liftTankers'
import { formatQty, remainingAfterQty, cn, availableQtyClass } from '../../lib/utils'
import {
  LOAD_ON_RISK_DETAIL,
  LOAD_ON_RISK_DETAIL_ACTIVE,
  LOAD_ON_RISK_LABEL,
} from '../../lib/loadOnRisk'
import { Checkbox } from '../ui/Checkbox'
import type { CaptionStrip } from '../ui/CaptionCard'

interface LiftTankersFormProps {
  tankers: LiftTankerFormValues[]
  maxQtyMt?: number
  poRemainingMt?: number
  soRemainingMt?: number
  /** planned = at dispatch; actual = at destination delivery */
  qtyMode?: 'planned' | 'actual'
  /** Hide qty fields when actuals are entered per SO instead. */
  hideQty?: boolean
  /** Hide the running total row — use when a parent summary already shows it. */
  hideTotal?: boolean
  tankerNoOptional?: boolean
  allowAddTanker?: boolean
  fieldErrors?: LiftTankerFieldErrorMap
  onChange: (tankers: LiftTankerFormValues[]) => void
}

export function buildLiftTankerAvailabilityCaption({
  tankers,
  maxQtyMt,
  poRemainingMt,
  soRemainingMt,
}: Pick<LiftTankersFormProps, 'tankers' | 'maxQtyMt' | 'poRemainingMt' | 'soRemainingMt'>): CaptionStrip | undefined {
  if (maxQtyMt == null || maxQtyMt <= 0) return undefined
  const totalEntered = totalActualQtyFromForm(tankers)
  const availableToLift = remainingAfterQty(maxQtyMt, totalEntered)
  const poAvailable = poRemainingMt != null ? remainingAfterQty(poRemainingMt, totalEntered) : null
  const soAvailable = soRemainingMt != null ? remainingAfterQty(soRemainingMt, totalEntered) : null

  return {
    label: 'Available to lift',
    value: (
      <span className={availableQtyClass(availableToLift)}>{formatQty(availableToLift)}</span>
    ),
    detail:
      poAvailable != null && soAvailable != null && poRemainingMt != null && soRemainingMt != null && poRemainingMt !== soRemainingMt
        ? `PO remaining: ${formatQty(poAvailable)} · SO remaining: ${formatQty(soAvailable)}`
        : undefined,
  }
}

export function buildLoadOnRiskCaption(
  loadOnRisk: boolean,
  onChange: (checked: boolean) => void,
): CaptionStrip {
  return {
    label: '',
    value: (
      <div onClick={e => e.stopPropagation()}>
        <Checkbox
          compact
          label={LOAD_ON_RISK_LABEL}
          checked={loadOnRisk}
          onChange={e => onChange(e.target.checked)}
        />
      </div>
    ),
    detail: loadOnRisk ? LOAD_ON_RISK_DETAIL_ACTIVE : LOAD_ON_RISK_DETAIL,
  }
}

export function LiftTankersForm({
  tankers,
  maxQtyMt,
  qtyMode = 'planned',
  hideQty = false,
  hideTotal = false,
  tankerNoOptional = false,
  allowAddTanker = true,
  fieldErrors,
  onChange,
}: LiftTankersFormProps) {
  const totalEntered = totalActualQtyFromForm(tankers)
  const suggested = suggestedTankerCount(totalEntered || maxQtyMt || 0)
  const needsMoreTankers = tankers.length < suggested
  const qtyLabel = qtyMode === 'actual' ? 'Actual quantity (MT)' : 'Planned quantity (MT)'
  const qtyPlaceholder = qtyMode === 'actual' ? 'e.g. 49.740' : 'e.g. 50'
  const totalLabel = qtyMode === 'actual' ? 'Actual quantity' : 'Total planned'

  const updateTanker = (index: number, patch: Partial<LiftTankerFormValues>) => {
    onChange(tankers.map((t, i) => (i === index ? { ...t, ...patch } : t)))
  }

  const addTanker = () => {
    onChange([...tankers, emptyLiftTankerForm()])
  }

  const removeTanker = (index: number) => {
    if (tankers.length <= 1) return
    onChange(tankers.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {needsMoreTankers && totalEntered > TANKER_CAPACITY_MT && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Add {suggested - tankers.length} more tanker{suggested - tankers.length === 1 ? '' : 's'} for this quantity.
        </p>
      )}

      <div className="space-y-3">
        {tankers.map((tanker, index) => {
          const tankerQty = parseFloat(tanker.actualQty) || 0
          const otherTankerQty = totalEntered - tankerQty
          const tankerMaxQty = maxQtyMt != null && maxQtyMt > 0 && qtyMode !== 'actual'
            ? Math.max(0, maxQtyMt - otherTankerQty)
            : undefined

          return (
          <div
            key={index}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-3 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Tanker {index + 1}
              </p>
              {tankers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTanker(index)}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors"
                  aria-label={`Remove tanker ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!hideQty && (
                <QtyInput
                  label={qtyLabel}
                  value={tanker.actualQty}
                  maxQty={tankerMaxQty}
                  maxQtyMessage={tankerMaxQty != null && tankerMaxQty > 0
                    ? `Cannot exceed ${formatQty(tankerMaxQty)} on this tanker`
                    : undefined}
                  error={fieldErrors?.[index]?.actualQty}
                  onChange={e => updateTanker(index, { actualQty: sanitizeQtyInput(e.target.value) })}
                  className="text-base"
                  placeholder={qtyPlaceholder}
                />
              )}
              <Input
                label={tankerNoOptional ? 'Tanker No. (optional)' : 'Tanker No.'}
                value={tanker.tankerNo}
                error={fieldErrors?.[index]?.tankerNo}
                onChange={e => updateTanker(index, { tankerNo: formatTankerNo(e.target.value) })}
                className="text-base uppercase font-mono"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. MH-12-RF-4236"
              />
              <Input
                label="Transport Name"
                value={tanker.transportName}
                onChange={e => updateTanker(index, { transportName: e.target.value })}
                className="text-base"
                placeholder="e.g. Shree Logistics"
              />
              <Input
                label="LR No."
                value={tanker.lrNo}
                onChange={e => updateTanker(index, { lrNo: e.target.value.toUpperCase() })}
                className="text-base uppercase"
                placeholder="e.g. LR-4521"
              />
              <Input
                label="Driver Mobile"
                value={tanker.driverMobile}
                onChange={e => updateTanker(index, { driverMobile: e.target.value })}
                className="text-base"
                type="tel"
                inputMode="tel"
                placeholder="e.g. 9876543210"
              />
            </div>
          </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {allowAddTanker && (
          <Button type="button" variant="outline" size="sm" onClick={addTanker}>
            <Plus className="h-4 w-4" />
            Add tanker
          </Button>
        )}
        {!hideQty && !hideTotal && (
          <p className={cn(
            'text-sm font-semibold tabular-nums text-heading',
            !allowAddTanker && 'ml-auto',
          )}>
            {totalLabel}: {formatQty(totalEntered)}
          </p>
        )}
      </div>
    </div>
  )
}

