import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type { SubscriptionPlan } from '../../api/platformApi'

export type PlanFormPayload = Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>

function rupeesFromCents(cents: number | undefined): string {
  if (cents == null || Number.isNaN(cents)) return ''
  return String(cents / 100)
}

function centsFromRupees(value: string): number {
  const n = Number(value.replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function emptyForm(): PlanFormPayload {
  return {
    slug: '',
    name: '',
    description: '',
    monthly_price_cents: 0,
    annual_price_cents: 0,
    additional_seat_monthly_price_cents: 0,
    additional_seat_annual_price_cents: 0,
    included_seats: 2,
    licence_type: 'perpetual',
    licence_price_cents: 0,
    included_admin_seats: 1,
    included_operator_seats: 1,
    additional_seat_licence_cents: 0,
    amc_price_cents: 0,
    additional_seat_amc_cents: 0,
    amc_duration_months: 12,
    amc_grace_days: 30,
    status: 'active',
  }
}

function formFromPlan(plan: SubscriptionPlan): PlanFormPayload {
  return {
    slug: plan.slug,
    name: plan.name,
    description: plan.description ?? '',
    monthly_price_cents: plan.monthly_price_cents ?? 0,
    annual_price_cents: plan.annual_price_cents ?? 0,
    additional_seat_monthly_price_cents: plan.additional_seat_monthly_price_cents ?? 0,
    additional_seat_annual_price_cents: plan.additional_seat_annual_price_cents ?? 0,
    included_seats: plan.included_seats,
    licence_type: plan.licence_type ?? 'perpetual',
    licence_price_cents: plan.licence_price_cents ?? 0,
    included_admin_seats: plan.included_admin_seats ?? 1,
    included_operator_seats: plan.included_operator_seats ?? 1,
    additional_seat_licence_cents: plan.additional_seat_licence_cents ?? 0,
    amc_price_cents: plan.amc_price_cents ?? 0,
    additional_seat_amc_cents: plan.additional_seat_amc_cents ?? 0,
    amc_duration_months: plan.amc_duration_months ?? 12,
    amc_grace_days: plan.amc_grace_days ?? 30,
    status: plan.status,
  }
}

export function PlatformPlanModal({
  open,
  onClose,
  plan,
  loading,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  plan: SubscriptionPlan | null
  loading: boolean
  onSubmit: (payload: PlanFormPayload) => void
}) {
  const [form, setForm] = useState<PlanFormPayload>(emptyForm())
  const [licenceRupees, setLicenceRupees] = useState('')
  const [amcRupees, setAmcRupees] = useState('')
  const [seatLicenceRupees, setSeatLicenceRupees] = useState('')
  const [seatAmcRupees, setSeatAmcRupees] = useState('')

  useEffect(() => {
    if (!open) return
    const next = plan ? formFromPlan(plan) : emptyForm()
    setForm(next)
    setLicenceRupees(rupeesFromCents(next.licence_price_cents))
    setAmcRupees(rupeesFromCents(next.amc_price_cents))
    setSeatLicenceRupees(rupeesFromCents(next.additional_seat_licence_cents))
    setSeatAmcRupees(rupeesFromCents(next.additional_seat_amc_cents))
  }, [open, plan])

  const slugLocked = Boolean(plan)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? 'Edit plan' : 'New plan'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            onClick={() =>
              onSubmit({
                ...form,
                slug: form.slug.trim().toLowerCase(),
                name: form.name.trim(),
                licence_price_cents: centsFromRupees(licenceRupees),
                amc_price_cents: centsFromRupees(amcRupees),
                additional_seat_licence_cents: centsFromRupees(seatLicenceRupees),
                additional_seat_amc_cents: centsFromRupees(seatAmcRupees),
                additional_seat_annual_price_cents: centsFromRupees(seatAmcRupees),
              })
            }
            disabled={!form.slug.trim() || !form.name.trim()}
          >
            Save plan
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted mb-4 leading-relaxed">
        These prices apply to new licences. Existing organisation licences keep the amounts recorded at purchase.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Plan name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
        <Input
          label="Slug"
          value={form.slug}
          readOnly={slugLocked}
          onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
        />
        <div className="sm:col-span-2">
          <Input
            label="Description"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>
        <Select
          searchable={false}
          label="Licence type"
          value={form.licence_type ?? 'perpetual'}
          onChange={e => setForm(f => ({ ...f, licence_type: e.target.value }))}
          options={[
            { value: 'perpetual', label: 'Perpetual' },
            { value: 'term', label: 'Term' },
          ]}
        />
        <Select
          searchable={false}
          label="Status"
          value={form.status}
          onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        <Input
          label="One-time licence (₹)"
          inputMode="decimal"
          value={licenceRupees}
          onChange={e => setLicenceRupees(e.target.value)}
        />
        <Input
          label="AMC (₹ / year)"
          inputMode="decimal"
          value={amcRupees}
          onChange={e => setAmcRupees(e.target.value)}
        />
        <Input
          label="Included seats"
          inputMode="numeric"
          value={String(form.included_seats)}
          onChange={e => setForm(f => ({ ...f, included_seats: Math.max(1, Number(e.target.value) || 1) }))}
        />
        <Input
          label="Included Admin seats"
          inputMode="numeric"
          value={String(form.included_admin_seats ?? 0)}
          onChange={e => setForm(f => ({ ...f, included_admin_seats: Math.max(0, Number(e.target.value) || 0) }))}
        />
        <Input
          label="Included Operator seats"
          inputMode="numeric"
          value={String(form.included_operator_seats ?? 0)}
          onChange={e => setForm(f => ({ ...f, included_operator_seats: Math.max(0, Number(e.target.value) || 0) }))}
        />
        <Input
          label="Additional seat licence (₹)"
          inputMode="decimal"
          value={seatLicenceRupees}
          onChange={e => setSeatLicenceRupees(e.target.value)}
        />
        <Input
          label="Additional seat AMC (₹ / year)"
          inputMode="decimal"
          value={seatAmcRupees}
          onChange={e => setSeatAmcRupees(e.target.value)}
        />
        <Input
          label="AMC duration (months)"
          inputMode="numeric"
          value={String(form.amc_duration_months ?? 12)}
          onChange={e => setForm(f => ({ ...f, amc_duration_months: Math.max(1, Number(e.target.value) || 1) }))}
        />
        <Input
          label="AMC grace period (days)"
          inputMode="numeric"
          value={String(form.amc_grace_days ?? 30)}
          onChange={e => setForm(f => ({ ...f, amc_grace_days: Math.max(0, Number(e.target.value) || 0) }))}
        />
      </div>
    </Modal>
  )
}
