import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { FormErrorBanner } from './FieldError'

interface StickyFormActionsProps {
  saveLabel: string
  onSave: () => void
  onCancel: () => void
  saveDisabled?: boolean
  saveLoading?: boolean
  error?: string
  extra?: ReactNode
}

/** Mobile-only fixed footer. Desktop CTAs live below Last entry in the sidebar. */
export function StickyFormActions({
  saveLabel,
  onSave,
  onCancel,
  saveDisabled,
  saveLoading,
  error,
  extra,
}: StickyFormActionsProps) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-card/95 backdrop-blur p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden"
      data-tour="form-actions-mobile"
    >
      {error && <FormErrorBanner className="mb-2">{error}</FormErrorBanner>}
      {extra && <div className="mb-2">{extra}</div>}
      <div className="flex gap-2 w-full">
        <Button variant="outline" className="flex-1 h-12" onClick={onCancel} disabled={saveLoading}>
          Cancel
        </Button>
        <Button className="flex-[1.4] h-12" onClick={onSave} disabled={saveDisabled} loading={saveLoading}>
          {saveLabel}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
