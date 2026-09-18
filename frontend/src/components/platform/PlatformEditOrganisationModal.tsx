import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { OrganisationLocationFields } from './OrganisationLocationFields'
import { DEFAULT_ORGANISATION_COUNTRY } from '../../lib/organisationLocations'
import type { PlatformOrganisation } from '../../api/platformApi'
import { organisationIsTest } from './platformAdminRegisterColumns'

interface Props {
  open: boolean
  onClose: () => void
  organisation: PlatformOrganisation | null
  loading: boolean
  onSubmit: (patch: {
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
  }) => void
}

export function PlatformEditOrganisationModal({
  open,
  onClose,
  organisation,
  loading,
  onSubmit,
}: Props) {
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
  })

  useEffect(() => {
    if (!open || !organisation) return
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
    })
  }, [open, organisation])

  const valid = form.name.trim() && form.business_address.trim() && form.city.trim()
  const isSandbox = Boolean(organisation?.sandbox_tools)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit organisation"
      size="lg"
      footerClassName="w-full items-center justify-between gap-3"
      footer={
        <>
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
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button loading={loading} disabled={!valid} onClick={() => onSubmit(form)}>
              Save changes
            </Button>
          </div>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 pt-1">
        <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input
          label="Legal name"
          value={form.legal_name}
          onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))}
        />
        <Input label="GSTIN" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
        <Input label="PAN" value={form.pan} onChange={e => setForm(f => ({ ...f, pan: e.target.value }))} />
        <div className="sm:col-span-2">
          <Input
            label="Business address"
            value={form.business_address}
            onChange={e => setForm(f => ({ ...f, business_address: e.target.value }))}
          />
        </div>
        <OrganisationLocationFields
          value={{
            city: form.city,
            state: form.state,
            country: form.country || DEFAULT_ORGANISATION_COUNTRY,
          }}
          onChange={loc => setForm(f => ({ ...f, ...loc }))}
        />
        <Input label="Pincode" value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} />
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
    </Modal>
  )
}
