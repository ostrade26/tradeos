import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Radio } from '../ui/Radio'
import { cn } from '../../lib/utils'
import type { CompanyType } from '../../data/mockData'
import { formatMatchScore, type CompanyResolutionResult } from '../../lib/companyResolution'

export interface PartyResolutionDraft {
  role: 'seller' | 'buyer'
  roleLabel: string
  result: CompanyResolutionResult
  selectedId: string
  newOfficialName: string
}

interface CompanyResolutionModalProps {
  open: boolean
  drafts: PartyResolutionDraft[]
  onClose: () => void
  onConfirm: (drafts: PartyResolutionDraft[]) => void
}

function draftKey(d: PartyResolutionDraft) {
  return d.role
}

export function CompanyResolutionModal({
  open,
  drafts: initialDrafts,
  onClose,
  onConfirm,
}: CompanyResolutionModalProps) {
  const [drafts, setDrafts] = useState(initialDrafts)

  useEffect(() => {
    if (open) setDrafts(initialDrafts)
  }, [open, initialDrafts])

  const updateDraft = (role: 'seller' | 'buyer', patch: Partial<PartyResolutionDraft>) => {
    setDrafts(prev => prev.map(d => d.role === role ? { ...d, ...patch } : d))
  }

  const handleConfirm = () => {
    for (const d of drafts) {
      if (d.selectedId === '__new__' && !d.newOfficialName.trim()) return
    }
    onConfirm(drafts)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm company match"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Apply & import</Button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        We found names that don&apos;t exactly match your directory. Link them to an existing company or create a new record.
        Confirmed names are saved as aliases for future PDF imports.
      </p>

      <div className="space-y-6">
        {drafts.map(draft => (
          <div key={draftKey(draft)} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{draft.roleLabel}</p>
              <p className="text-sm mt-1">
                Extracted from PDF:{' '}
                <span className="font-medium text-heading">&ldquo;{draft.result.extractedName}&rdquo;</span>
              </p>
            </div>

            <div className="space-y-2">
              {draft.result.suggestions.length > 0 && (
                <p className="text-xs font-medium text-gray-500 dark:text-muted mb-1">
                  Link to existing company in your directory
                </p>
              )}

              {draft.result.suggestions.map(s => (
                <label
                  key={s.company.id}
                  className={cn(
                    'flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors',
                    draft.selectedId === s.company.id
                      ? 'border-accent bg-accent/5'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
                  )}
                >
                  <Radio
                    name={`company-${draft.role}`}
                    className="mt-1"
                    checked={draft.selectedId === s.company.id}
                    onChange={() => updateDraft(draft.role, { selectedId: s.company.id })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-heading">{s.company.officialName}</p>
                    {s.company.location && (
                      <p className="text-xs text-muted mt-0.5">{s.company.location}</p>
                    )}
                    {s.company.aliases.length > 0 && (
                      <p className="text-xs text-muted mt-0.5 truncate">
                        Also known as: {s.company.aliases.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted shrink-0">{formatMatchScore(s.score)} match</span>
                </label>
              ))}

              {draft.result.suggestions.length > 0 && (
                <p className="text-xs font-medium text-gray-500 dark:text-muted pt-2 mb-1">
                  Or create a new company record
                </p>
              )}

              <label
                className={cn(
                  'flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors',
                  draft.selectedId === '__new__'
                    ? 'border-accent bg-accent/5'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
                )}
              >
                <Radio
                  name={`company-${draft.role}`}
                  className="mt-1"
                  checked={draft.selectedId === '__new__'}
                  onChange={() => updateDraft(draft.role, { selectedId: '__new__' })}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-heading">Create new company</p>
                  {draft.selectedId === '__new__' && (
                    <Input
                      className="mt-2"
                      placeholder="Official company name"
                      value={draft.newOfficialName}
                      onChange={e => updateDraft(draft.role, { newOfficialName: e.target.value })}
                    />
                  )}
                </div>
              </label>

              {draft.result.suggestions.length === 0 && draft.selectedId !== '__new__' && (
                <p className="text-xs text-muted">No close matches — create a new company record.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export function buildResolutionDrafts(
  seller: CompanyResolutionResult,
  buyer: CompanyResolutionResult,
): PartyResolutionDraft[] {
  const drafts: PartyResolutionDraft[] = []

  if (seller.extractedName && seller.confidence !== 'high') {
    drafts.push({
      role: 'seller',
      roleLabel: 'Seller',
      result: seller,
      selectedId: seller.suggestions[0]?.company.id ?? '__new__',
      newOfficialName: seller.suggestions[0]?.company.officialName ?? seller.extractedName,
    })
  }

  if (buyer.extractedName && buyer.confidence !== 'high') {
    drafts.push({
      role: 'buyer',
      roleLabel: 'Buyer',
      result: buyer,
      selectedId: buyer.suggestions[0]?.company.id ?? '__new__',
      newOfficialName: buyer.suggestions[0]?.company.officialName ?? buyer.extractedName,
    })
  }

  return drafts
}

export type { CompanyType }
