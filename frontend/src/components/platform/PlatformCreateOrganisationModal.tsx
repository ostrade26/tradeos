import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { OrganisationLocationFields } from './OrganisationLocationFields'
import { loginEmailError } from '../../lib/email'
import { loginUsernameError } from '../../lib/username'
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
  admin_username: '',
  admin_email: '',
  admin_mobile: '',
  is_test: false,
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
  const [step, setStep] = useState<1 | 2>(1)
  const [usernameTouched, setUsernameTouched] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm(emptyOrganisationForm())
      setStep(1)
      setUsernameTouched(false)
      return
    }
    const preferred =
      plans.find(p => p.slug === 'tradeal-standard' && p.status === 'active') ??
      plans.find(p => p.slug === 'tradeal-standard') ??
      plans.find(p => p.status === 'active') ??
      null
    if (preferred) {
      setForm(f => ({ ...f, plan_id: String(preferred.id) }))
    }
  }, [open, plans])

  const selectedPlan =
    plans.find(p => String(p.id) === form.plan_id) ??
    plans.find(p => p.slug === 'tradeal-standard') ??
    null
  const usernameError = usernameTouched ? loginUsernameError(form.admin_username) : null
  const emailError = loginEmailError(form.admin_email)
  const accountValid = Boolean(
    form.name.trim() &&
    form.business_address.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    form.country.trim() &&
    form.pincode.trim(),
  )
  const adminValid = Boolean(
    form.admin_name.trim() &&
    !loginUsernameError(form.admin_username) &&
    !emailError,
  )

  const testAccountControl = (
    <div className="flex min-w-0 items-start gap-2">
      <Checkbox
        id="create-org-is-test"
        compact
        checked={form.is_test}
        onChange={e => setForm(f => ({ ...f, is_test: e.target.checked }))}
        aria-label="Test account"
        className="mt-0.5"
      />
      <label htmlFor="create-org-is-test" className="min-w-0 cursor-pointer">
        <p className="text-sm text-heading">Test account</p>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          For QA only — listed under Test and safe to delete later.
        </p>
      </label>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add organisation"
      subtitle={step === 1 ? 'Customer account and plan.' : 'Primary admin — email and login details.'}
      size="lg"
      footerClassName="w-full items-center justify-between gap-3"
      footer={
        step === 1 ? (
          <>
            {testAccountControl}
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={!accountValid} onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          </>
        ) : (
          <>
            {testAccountControl}
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
                Back
              </Button>
              <Button loading={loading} disabled={!adminValid || loading} onClick={() => onSubmit(form)}>
                Create organisation
              </Button>
            </div>
          </>
        )
      }
    >
      {step === 1 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Trader Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Organisation Name" value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} />
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
          <Input
            label="Subscription plan"
            value={
              plans.find(p => p.slug === 'tradeal-standard')?.name ??
              selectedPlan?.name ??
              'Tradeal Standard'
            }
            readOnly
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
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-heading">Primary Admin</p>
            <p className="text-xs text-muted mt-1">
              Uses the first included seat · we email their login ID and temporary password to the
              address below, and also show it once after create
            </p>
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Email *"
              type="email"
              autoComplete="off"
              placeholder="admin@company.com"
              value={form.admin_email}
              error={emailError ?? undefined}
              onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))}
            />
          </div>
          <Input label="Admin name *" value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} />
          <Input
            label="Username (login ID) *"
            autoComplete="off"
            placeholder="kubera.admin"
            value={form.admin_username}
            error={usernameError ?? undefined}
            onChange={e => setForm(f => ({ ...f, admin_username: e.target.value }))}
            onBlur={() => setUsernameTouched(true)}
          />
          <Input
            label="Mobile"
            className="sm:col-span-2"
            value={form.admin_mobile}
            onChange={e => setForm(f => ({ ...f, admin_mobile: e.target.value }))}
          />
        </div>
      )}
    </Modal>
  )
}
