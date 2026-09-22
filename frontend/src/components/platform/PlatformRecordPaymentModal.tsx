import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type {
  OrganisationPayment,
  PaymentStatus,
  PaymentType,
  PlatformOrganisation,
} from '../../api/platformApi'
import { organisationIsTest } from './platformAdminRegisterColumns'

function centsFromRupees(value: string): number {
  const n = Number(value.replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function rupeesFromCents(cents: number): string {
  if (!Number.isFinite(cents)) return ''
  const rupees = cents / 100
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2)
}

export type PaymentFormPayload = {
  organisation_id: number
  payment_type: PaymentType
  amount_cents: number
  payment_date: string
  payment_reference: string
  status: PaymentStatus
  notes: string
}

export function PlatformRecordPaymentModal({
  open,
  onClose,
  organisations,
  defaultOrganisationId,
  payment,
  loading,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  organisations: PlatformOrganisation[]
  defaultOrganisationId?: number | null
  payment?: OrganisationPayment | null
  loading: boolean
  onSubmit: (payload: PaymentFormPayload) => void
}) {
  const editing = payment != null
  const [organisationId, setOrganisationId] = useState('')
  const [paymentType, setPaymentType] = useState<PaymentType>('licence')
  const [amountRupees, setAmountRupees] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [reference, setReference] = useState('')
  const [status, setStatus] = useState<PaymentStatus>('paid')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    if (payment) {
      setOrganisationId(String(payment.organisation_id))
      setPaymentType((payment.payment_type as PaymentType) || 'licence')
      setAmountRupees(rupeesFromCents(payment.amount_cents))
      setPaymentDate(String(payment.payment_date || '').slice(0, 10))
      setReference(payment.payment_reference ?? '')
      setStatus((payment.status as PaymentStatus) || 'paid')
      setNotes(payment.notes ?? '')
      return
    }
    setOrganisationId(defaultOrganisationId ? String(defaultOrganisationId) : '')
    setPaymentType('licence')
    setAmountRupees('')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setReference('')
    setStatus('paid')
    setNotes('')
  }, [open, defaultOrganisationId, payment])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit payment' : 'Record payment'}
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
            {editing ? 'Save changes' : 'Save payment'}
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
            disabled={editing}
            options={organisations.map(o => ({
              value: String(o.id),
              label: organisationIsTest(o) ? `${o.name} (Test)` : o.name,
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
