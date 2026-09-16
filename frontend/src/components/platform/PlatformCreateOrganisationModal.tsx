import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { OrganisationLocationFields } from './OrganisationLocationFields'
import { DEFAULT_ORGANISATION_COUNTRY } from '../../lib/organisationLocations'
import type { BillingCycle, SubscriptionPlan } from '../../api/platformApi'

export const emptyOrganisationForm = () => ({
  name: '',
  legal_name: '',
  gstin: '',
  pan: '',
  business_address: '',
  city: '',
  state: '',
  country: DEFAULT_ORGANISATION_COUNTRY,
  pincode: '',
  plan_id: '',
  billing_cycle: 'annual' as BillingCycle,
  admin_name: '',
  admin_email: '',
  admin_mobile: '',
})

export type OrganisationFormState = ReturnType<typeof emptyOrganisationForm>

interface Props {
  open: boolean
  onClose: () => void
  plans: SubscriptionPlan[]
  loading: boolean
  onSubmit: (form: OrganisationFormState) => void
}

export function PlatformCreateOrganisationModal({ open, onClose, plans, loading, onSubmit }: Props) {
  const [form, setForm] = useState(emptyOrganisationForm)

  useEffect(() => {
    if (!open) setForm(emptyOrganisationForm())
  }, [open])

  const valid =
    form.name.trim() &&
    form.business_address.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    form.country.trim() &&
    form.pincode.trim() &&
    form.admin_name.trim() &&
    form.admin_email.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add organisation"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} disabled={!valid || loading} onClick={() => onSubmit(form)}>
            Create organisation
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 pt-1">
        <Input label="Organisation name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Legal name" value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} />
        <Input
          label="Business address *"
          className="sm:col-span-2"
          value={form.business_address}
          onChange={e => setForm(f => ({ ...f, business_address: e.target.value }))}
        />
        <OrganisationLocationFields
          required
          value={{ city: form.city, state: form.state, country: form.country }}
          onChange={loc => setForm(f => ({ ...f, ...loc }))}
        />
        <Input label="Pincode *" value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} />
        <Input label="GSTIN" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
        <Input label="PAN" value={form.pan} onChange={e => setForm(f => ({ ...f, pan: e.target.value }))} />
        <Select
          label="Subscription plan"
          options={[
            { value: '', label: 'Default plan' },
            ...plans.filter(p => p.status === 'active').map(p => ({
              value: String(p.id),
              label: `${p.name} (${p.included_seats} seat${p.included_seats === 1 ? '' : 's'})`,
            })),
          ]}
          value={form.plan_id}
          onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))}
          searchable={false}
        />
        <Select
          label="Billing cycle"
          options={[
            { value: 'annual', label: 'Annual' },
            { value: 'monthly', label: 'Monthly' },
          ]}
          value={form.billing_cycle}
          onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value as BillingCycle }))}
          searchable={false}
        />
        <div className="sm:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-3">
          <p className="text-sm font-medium text-heading">Primary Organisation Admin</p>
          <p className="text-xs text-muted mt-1">
            Uses the first included seat · signs in with email and the default org password (shown after create)
          </p>
        </div>
        <Input label="Admin name *" value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} />
        <Input label="Admin email (login ID) *" type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} />
        <Input label="Mobile" value={form.admin_mobile} onChange={e => setForm(f => ({ ...f, admin_mobile: e.target.value }))} />
      </div>
    </Modal>
  )
}
