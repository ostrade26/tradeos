import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { OrganisationLocationFields } from './OrganisationLocationFields'
import { loginEmailError } from '../../lib/email'
import { DEFAULT_ORGANISATION_COUNTRY } from '../../lib/organisationLocations'
import type { PlatformOrganisation, PrimaryAdminUserSummary } from '../../api/platformApi'

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
      footer={
        step === 1 ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button disabled={!accountValid} onClick={() => setStep(2)}>
              Next
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
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
        <div className="grid gap-4 sm:grid-cols-2 pt-1">
          <div className="sm:col-span-2 rounded-md border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
            <p className="text-sm font-medium text-heading">Primary Admin</p>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Uses the first included seat · we email their login ID and temporary password to the
              address below when credentials are issued. Updating email also updates the primary
              admin login.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Input
              type="email"
              label="Admin email *"
              autoComplete="email"
              value={form.primary_contact_email}
              error={emailError ?? undefined}
              onChange={e => setForm(f => ({ ...f, primary_contact_email: e.target.value }))}
            />
          </div>
          <Input
            label="Contact name *"
            value={form.primary_contact_name}
            onChange={e => setForm(f => ({ ...f, primary_contact_name: e.target.value }))}
          />
          <Input
            label="Mobile"
            value={form.primary_contact_mobile}
            onChange={e => setForm(f => ({ ...f, primary_contact_mobile: e.target.value }))}
          />
        </div>
      )}
    </Modal>
  )
}
