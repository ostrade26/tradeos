import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type { PaymentStatus, PaymentType, PlatformOrganisation } from '../../api/platformApi'

function centsFromRupees(value: string): number {
  const n = Number(value.replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

export function PlatformRecordPaymentModal({
  open,
  onClose,
  organisations,
  defaultOrganisationId,
  loading,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  organisations: PlatformOrganisation[]
  defaultOrganisationId?: number | null
  loading: boolean
  onSubmit: (payload: {
    organisation_id: number
    payment_type: PaymentType
    amount_cents: number
    payment_date: string
    payment_reference: string
    status: PaymentStatus
    notes: string
  }) => void
}) {
  const [organisationId, setOrganisationId] = useState('')
  const [paymentType, setPaymentType] = useState<PaymentType>('licence')
  const [amountRupees, setAmountRupees] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [reference, setReference] = useState('')
  const [status, setStatus] = useState<PaymentStatus>('paid')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setOrganisationId(defaultOrganisationId ? String(defaultOrganisationId) : '')
    setPaymentType('licence')
    setAmountRupees('')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setReference('')
    setStatus('paid')
    setNotes('')
  }, [open, defaultOrganisationId])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!organisationId || !amountRupees}
            onClick={() =>
              onSubmit({
                organisation_id: Number(organisationId),
                payment_type: paymentType,
                amount_cents: centsFromRupees(amountRupees),
                payment_date: paymentDate,
                payment_reference: reference.trim(),
                status,
                notes: notes.trim(),
              })
            }
          >
            Save payment
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select
            label="Organisation"
            value={organisationId}
            onChange={e => setOrganisationId(e.target.value)}
            options={organisations.map(o => ({
              value: String(o.id),
              label: o.name,
              description: o.org_code ?? undefined,
            }))}
          />
        </div>
        <Select
          searchable={false}
          label="Payment type"
          value={paymentType}
          onChange={e => setPaymentType(e.target.value as PaymentType)}
          options={[
            { value: 'licence', label: 'Licence' },
            { value: 'amc', label: 'AMC' },
            { value: 'additional_seat', label: 'Additional seat' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Select
          searchable={false}
          label="Status"
          value={status}
          onChange={e => setStatus(e.target.value as PaymentStatus)}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
            { value: 'failed', label: 'Failed' },
            { value: 'refunded', label: 'Refunded' },
          ]}
        />
        <Input
          label="Amount (₹)"
          inputMode="decimal"
          value={amountRupees}
          onChange={e => setAmountRupees(e.target.value)}
        />
        <Input
          type="date"
          label="Payment date"
          value={paymentDate}
          onChange={e => setPaymentDate(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Input
            label="Payment reference"
            value={reference}
            onChange={e => setReference(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
