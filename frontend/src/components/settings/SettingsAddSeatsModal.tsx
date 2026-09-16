import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { OrganisationSeatRequestContext } from '../../api/organisationApi'
import { organisationApi } from '../../api/organisationApi'
import { ApiError } from '../../api/client'
import { formatInrCents, ORG_SEAT_TYPE_OPTIONS, type OrgSeatType } from '../../lib/platformLabels'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Drawer'
import { Select } from '../ui/Select'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../lib/utils'

const MAX_REQUESTED_SEATS = 20

function SeatCountStepper({
  value,
  onChange,
  min = 1,
  max = MAX_REQUESTED_SEATS,
  disabled,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Number of seats</span>
      <div
        className={cn(
          'flex h-11 sm:h-9 items-stretch overflow-hidden rounded-md border border-gray-200 bg-white',
          'dark:border-gray-600 dark:bg-card',
          disabled && 'opacity-60 pointer-events-none',
        )}
      >
        <button
          type="button"
          aria-label="Decrease number of seats"
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className={cn(
            'flex w-11 shrink-0 items-center justify-center border-r border-gray-200 text-heading',
            'hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-muted dark:border-gray-600 dark:hover:bg-gray-800/60',
            'attex-focus cursor-pointer',
          )}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <div className="flex min-w-[3rem] flex-1 items-center justify-center text-sm font-semibold tabular-nums text-heading">
          {value}
        </div>
        <button
          type="button"
          aria-label="Increase number of seats"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className={cn(
            'flex w-11 shrink-0 items-center justify-center border-l border-gray-200 text-heading',
            'hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-muted dark:border-gray-600 dark:hover:bg-gray-800/60',
            'attex-focus cursor-pointer',
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function SettingsAddSeatsModal({
  open,
  onClose,
  canRequest,
  ctx,
  loading,
  onSeatsChanged,
  onRequestSuccess,
  defaultSeatType = 'operator',
}: {
  open: boolean
  onClose: () => void
  canRequest: boolean
  ctx: OrganisationSeatRequestContext | null
  loading: boolean
  onSeatsChanged?: () => void
  onRequestSuccess?: () => void
  defaultSeatType?: OrgSeatType
}) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [requestedSeats, setRequestedSeats] = useState(1)
  const [seatType, setSeatType] = useState<OrgSeatType>('operator')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setRequestedSeats(1)
      setSeatType(defaultSeatType)
      setNote('')
    }
  }, [open, defaultSeatType])

  const inFlight = useMemo(
    () => ctx?.requests.some(r => r.status === 'pending_payment' || r.status === 'paid') ?? false,
    [ctx?.requests],
  )

  const unitPrice = ctx?.addon_seat_unit_price_cents ?? 0
  const cycleLabel = ctx?.billing_cycle === 'monthly' ? 'month' : 'year'
  const estimatedTotal = unitPrice > 0 ? unitPrice * requestedSeats : 0
  const unitPriceSubtitle =
    !loading && canRequest && unitPrice > 0 ? (
      <>
        <span className="font-semibold tabular-nums text-heading">{formatInrCents(unitPrice)}</span>
        {' '}
        per seat / {cycleLabel}
      </>
    ) : undefined

  const submit = async () => {
    setSubmitting(true)
    try {
      await organisationApi.createSeatRequest({
        requested_seats: requestedSeats,
        seat_type: seatType,
        note: note.trim(),
      })
      onSeatsChanged?.()
      onClose()
      onRequestSuccess?.()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not submit seat request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add seat"
      subtitle={unitPriceSubtitle}
      size="md"
      footerClassName={canRequest && unitPrice > 0 ? 'items-center' : undefined}
      footer={
        canRequest && unitPrice > 0 ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold tabular-nums text-heading">{formatInrCents(estimatedTotal)}</p>
              <p className="text-xs text-muted mt-0.5">Including GST</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button disabled={submitting || inFlight || loading} loading={submitting} onClick={() => void submit()}>
                Request seats
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex w-full justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )
      }
    >
      {loading ? (
        <p className="text-sm text-muted">Loading seat options…</p>
      ) : !canRequest ? (
        <p className="text-sm text-muted">You do not have permission to request seats. Contact your org admin.</p>
      ) : unitPrice <= 0 ? (
        <p className="text-sm text-muted">Add-on seat pricing is not configured for your plan yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              searchable={false}
              label="Seat type"
              placeholder="Select seat type"
              options={ORG_SEAT_TYPE_OPTIONS.map(o => ({
                value: o.value,
                label: o.label,
                keywords: o.value === 'view_only' ? 'viewer view only' : 'operator',
              }))}
              value={seatType}
              onChange={e => setSeatType(e.target.value as OrgSeatType)}
            />
            <SeatCountStepper
              value={requestedSeats}
              onChange={setRequestedSeats}
              disabled={submitting || inFlight}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="seat-request-note-modal" className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Note for Tradeal (optional)
            </label>
            <textarea
              id="seat-request-note-modal"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className={cn(
                'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-heading',
                'placeholder:text-muted transition-colors duration-150',
                'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
                'dark:border-gray-600 dark:bg-card dark:text-heading',
              )}
              placeholder="PO number, billing contact, etc."
            />
          </div>
          {inFlight && (
            <p className="text-xs text-muted">
              A request is awaiting approval — cancel it under Your requests to submit a new one.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
