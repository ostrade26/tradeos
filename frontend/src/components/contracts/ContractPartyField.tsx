import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { organisationApi, type BrokerOrganisationMatch } from '../../api/organisationApi'
import { ApiError } from '../../api/client'
import { cn } from '../../lib/utils'

function orgCodeReady(code: string): boolean {
  return /^(X)?T[OB]A\d{6,}$/i.test(code.trim())
}

function useOrganisationLookup(code: string) {
  const [organisation, setOrganisation] = useState<BrokerOrganisationMatch | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = code.trim()
    if (!orgCodeReady(trimmed)) {
      setOrganisation(null)
      setError('')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(() => {
      organisationApi.lookupBrokerOrganisation(trimmed)
        .then(res => {
          if (cancelled) return
          setOrganisation(res.organisation)
          setError('')
        })
        .catch(err => {
          if (cancelled) return
          setOrganisation(null)
          setError(err instanceof ApiError ? err.message : 'No organisation found')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [code])

  return { organisation, error, loading }
}

function PartyChannelToggle({
  label,
  onTradeal,
  onChange,
  disabled,
}: {
  label: string
  onTradeal: boolean
  onChange: (onTradeal: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          onTradeal ? 'bg-accent-muted text-accent' : 'text-muted hover:bg-gray-100 dark:hover:bg-gray-800',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {label} on Tradeal
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          !onTradeal ? 'bg-warning-muted text-warning' : 'text-muted hover:bg-gray-100 dark:hover:bg-gray-800',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        Not on Tradeal yet
      </button>
    </div>
  )
}

function OrganisationMatch({
  loading,
  organisation,
}: {
  loading: boolean
  organisation: BrokerOrganisationMatch | null
}) {
  if (loading) return <p className="text-sm text-muted">Looking up…</p>
  if (!organisation) return null
  const place = [organisation.city, organisation.state].filter(Boolean).join(', ')
  return (
    <div className="rounded-md border border-gray-200 px-3 py-2.5 dark:border-gray-700">
      <p className="text-sm font-semibold text-heading">{organisation.name}</p>
      {organisation.legal_name && organisation.legal_name !== organisation.name ? (
        <p className="mt-0.5 text-sm text-heading">{organisation.legal_name}</p>
      ) : null}
      {place ? <p className="mt-0.5 text-xs text-muted">{place}</p> : null}
      {organisation.gstin ? <p className="mt-0.5 text-xs text-muted">GSTIN {organisation.gstin}</p> : null}
    </div>
  )
}

export type ContractPartyValue = {
  onTradeal: boolean
  orgCode: string
  externalName: string
  externalEmail: string
  externalPhone: string
}

export function contractPartyDisplay(
  value: ContractPartyValue,
  organisation: BrokerOrganisationMatch | null,
): string {
  if (value.onTradeal) {
    if (organisation?.name) return organisation.name
    const code = value.orgCode.trim()
    if (code) return code.toUpperCase()
    return ''
  }
  return value.externalName.trim()
}

export function contractPartyHint(value: ContractPartyValue): string {
  if (value.onTradeal) {
    const code = value.orgCode.trim()
    return code ? `On Tradeal · ${code.toUpperCase()}` : 'On Tradeal'
  }
  const contact = value.externalEmail.trim() || value.externalPhone.trim()
  return contact ? `Not on Tradeal · ${contact}` : 'Not on Tradeal'
}

export function ContractPartyField({
  label,
  value,
  organisation,
  channelToggleDisabled,
  fieldError,
  onChange,
}: {
  label: string
  value: ContractPartyValue
  organisation: BrokerOrganisationMatch | null
  channelToggleDisabled?: boolean
  fieldError?: string
  onChange: (next: ContractPartyValue) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ContractPartyValue>(value)
  const [modalError, setModalError] = useState('')
  const draftOrg = useOrganisationLookup(open && draft.onTradeal ? draft.orgCode : '')

  useEffect(() => {
    if (!open) setDraft(value)
  }, [open, value])

  const display = contractPartyDisplay(value, organisation)
  const hint = contractPartyHint(value)

  const openModal = () => {
    setDraft(value)
    setModalError('')
    setOpen(true)
  }

  const confirm = () => {
    if (draft.onTradeal) {
      if (!orgCodeReady(draft.orgCode)) {
        setModalError('Enter a valid organisation code')
        return
      }
      if (draftOrg.loading) return
      if (!draftOrg.organisation) {
        setModalError(draftOrg.error || 'No organisation found')
        return
      }
    } else {
      if (!draft.externalName.trim()) {
        setModalError('Enter the party name')
        return
      }
      if (!draft.externalEmail.trim() && !draft.externalPhone.trim()) {
        setModalError('Enter email or mobile to send the contract')
        return
      }
    }
    onChange(draft)
    setOpen(false)
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</span>
        <button
          type="button"
          onClick={openModal}
          className={cn(
            'flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm transition-colors sm:min-h-9 sm:py-1.5',
            'hover:border-gray-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
            'dark:border-gray-600 dark:bg-card dark:hover:border-gray-500',
            fieldError && 'border-danger ring-1 ring-danger/30',
          )}
        >
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate', display ? 'text-heading' : 'text-placeholder')}>
              {display || `Choose ${label.toLowerCase()}…`}
            </span>
            {display ? (
              <span className="mt-0.5 block truncate text-xs text-muted">{hint}</span>
            ) : null}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        </button>
        {fieldError ? <p className="text-sm text-danger">{fieldError}</p> : null}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        subtitle="On Tradeal organisation or contact details for parties not on Tradeal yet."
        size="md"
        footer={(
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={confirm} disabled={draft.onTradeal && draftOrg.loading}>Done</Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <PartyChannelToggle
            label={label}
            onTradeal={draft.onTradeal}
            disabled={channelToggleDisabled}
            onChange={onTradeal => setDraft(current => ({ ...current, onTradeal }))}
          />
          {draft.onTradeal ? (
            <div className="space-y-1.5">
              <Input
                label="Organisation code"
                value={draft.orgCode}
                placeholder="TOA100001"
                error={modalError || draftOrg.error || undefined}
                onChange={e => {
                  setModalError('')
                  setDraft(current => ({ ...current, orgCode: e.target.value.toUpperCase() }))
                }}
              />
              <OrganisationMatch loading={draftOrg.loading} organisation={draftOrg.organisation} />
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                label="Name"
                value={draft.externalName}
                error={modalError && !draft.externalName.trim() ? modalError : undefined}
                onChange={e => {
                  setModalError('')
                  setDraft(current => ({ ...current, externalName: e.target.value }))
                }}
              />
              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="Email"
                  type="email"
                  value={draft.externalEmail}
                  onChange={e => {
                    setModalError('')
                    setDraft(current => ({ ...current, externalEmail: e.target.value }))
                  }}
                />
                <Input
                  label="Mobile"
                  value={draft.externalPhone}
                  onChange={e => {
                    setModalError('')
                    setDraft(current => ({ ...current, externalPhone: e.target.value }))
                  }}
                />
              </div>
              {modalError && draft.externalName.trim() ? (
                <p className="text-sm text-danger">{modalError}</p>
              ) : null}
              <p className="text-xs text-muted">Email or mobile is required — we email the PDF and you can share the link on WhatsApp.</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

export function useContractPartyOrgLookup(onTradeal: boolean, orgCode: string) {
  return useOrganisationLookup(onTradeal ? orgCode : '')
}
