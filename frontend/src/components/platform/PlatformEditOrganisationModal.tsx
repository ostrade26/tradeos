import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { OrganisationLocationFields } from './OrganisationLocationFields'
import { loginEmailError } from '../../lib/email'
import { DEFAULT_ORGANISATION_COUNTRY } from '../../lib/organisationLocations'
import type { PlatformOrganisation, PrimaryAdminUserSummary } from '../../api/platformApi'
import { organisationIsTest } from './platformAdminRegisterColumns'

export type EditOrganisationPatch = {
  name: string
  legal_name: string
  gstin: string
  pan: string
  business_address: string
  city: string
  state: string
  country: string
  pincode: string
  status: string
  is_test: boolean
  primary_contact_name: string
  primary_contact_email: string
  primary_contact_mobile: string
}

interface Props {
  open: boolean
  onClose: () => void
  organisation: PlatformOrganisation | null
  primaryAdmin?: PrimaryAdminUserSummary | null
  loading: boolean
  onSubmit: (patch: EditOrganisationPatch) => void
}

export function PlatformEditOrganisationModal({
  open,
  onClose,
  organisation,
  primaryAdmin,
  loading,
  onSubmit,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState({
    name: '',
    legal_name: '',
    gstin: '',
    pan: '',
    business_address: '',
    city: '',
    state: '',
    country: '',
    pincode: '',
    status: 'active',
    is_test: false,
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_mobile: '',
  })

  useEffect(() => {
    if (!open || !organisation) return
    setStep(1)
    setForm({
      name: organisation.name ?? '',
      legal_name: organisation.legal_name ?? '',
      gstin: organisation.gstin ?? '',
      pan: organisation.pan ?? '',
      business_address: organisation.business_address ?? '',
      city: organisation.city ?? '',
      state: organisation.state ?? '',
      country: organisation.country ?? '',
      pincode: organisation.pincode ?? '',
      status:
        organisation.status === 'disabled' || organisation.status === 'inactive'
          ? 'inactive'
          : 'active',
      is_test: organisationIsTest(organisation),
      primary_contact_name:
        organisation.primary_contact_name?.trim() ||
        primaryAdmin?.name?.trim() ||
        '',
      primary_contact_email:
        organisation.primary_contact_email?.trim() ||
        primaryAdmin?.email?.trim() ||
        '',
      primary_contact_mobile: organisation.primary_contact_mobile ?? '',
    })
  }, [open, organisation, primaryAdmin])

  const emailError = loginEmailError(form.primary_contact_email)
  const accountValid = Boolean(
    form.name.trim() && form.business_address.trim() && form.city.trim(),
  )
  const contactValid = Boolean(form.primary_contact_name.trim() && !emailError)
  const isSandbox = Boolean(organisation?.sandbox_tools)
  const loginId = primaryAdmin?.login_id || primaryAdmin?.username || ''

  const testAccountControl = (
    <div className="flex min-w-0 items-start gap-2">
      <Checkbox
        id="edit-org-is-test"
        compact
        checked={form.is_test}
        onChange={e => setForm(f => ({ ...f, is_test: e.target.checked }))}
        aria-label="Test account"
        className="mt-0.5"
      />
      <label htmlFor="edit-org-is-test" className="min-w-0 cursor-pointer">
        <p className="text-sm text-heading">Test account</p>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          {isSandbox
            ? 'For QA only — listed under Test. The system sandbox cannot be deleted.'
            : 'For QA only — listed under Test and safe to delete later.'}
        </p>
      </label>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit organisation"
      subtitle={
        step === 1
          ? 'Customer account details.'
          : 'Primary admin — email and login details.'
      }
      size="lg"
      footerClassName="w-full items-center justify-between gap-3"
      footer={
        step === 1 ? (
          <>
            {testAccountControl}
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>
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
              <Button
                loading={loading}
                disabled={!contactValid || loading}
                onClick={() => onSubmit(form)}
              >
                Save changes
              </Button>
            </div>
          </>
        )
      }
    >
      {step === 1 ? (
        <div className="grid gap-4 sm:grid-cols-2 pt-1">
          <Input label="Trader Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input
            label="Organisation Name"
            value={form.legal_name}
            onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <Input
              label="Business address *"
              value={form.business_address}
              onChange={e => setForm(f => ({ ...f, business_address: e.target.value }))}
            />
          </div>
          <OrganisationLocationFields
            required
            value={{
              city: form.city,
              state: form.state,
              country: form.country || DEFAULT_ORGANISATION_COUNTRY,
            }}
            onChange={loc => setForm(f => ({ ...f, ...loc }))}
          />
          <Input label="Pincode" value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} />
          <Input label="GSTIN" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
          <Input label="PAN" value={form.pan} onChange={e => setForm(f => ({ ...f, pan: e.target.value }))} />
          <Select
            label="Status"
            searchable={false}
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Deactivated' },
            ]}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-heading">Primary Organisation Admin</p>
            <p className="text-xs text-muted mt-1">
              Uses the first included seat · we email their login ID and temporary password to the
              address below when credentials are issued. Updating email also updates the primary
              admin user (for welcome / forgot password).
            </p>
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Email *"
              type="email"
              autoComplete="off"
              placeholder="admin@company.com"
              value={form.primary_contact_email}
              error={emailError ?? undefined}
              onChange={e => setForm(f => ({ ...f, primary_contact_email: e.target.value }))}
            />
          </div>
          <Input
            label="Admin name *"
            value={form.primary_contact_name}
            onChange={e => setForm(f => ({ ...f, primary_contact_name: e.target.value }))}
          />
          <Input
            label="Username (login ID) *"
            value={loginId || '—'}
            readOnly
          />
          <Input
            label="Mobile"
            className="sm:col-span-2"
            value={form.primary_contact_mobile}
            onChange={e => setForm(f => ({ ...f, primary_contact_mobile: e.target.value }))}
          />
        </div>
      )}
    </Modal>
  )
}
