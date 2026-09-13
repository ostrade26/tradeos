import type { ReactNode } from 'react'
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

export function StickyFormActions({
  saveLabel,
  onSave,
  onCancel,
  saveDisabled,
  saveLoading,
  error,
  extra,
}: StickyFormActionsProps) {
  return (
    <>
      <div className="hidden sm:flex flex-col gap-2">
        {extra}
        {error && <FormErrorBanner>{error}</FormErrorBanner>}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-card/95 backdrop-blur p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
        {error && <FormErrorBanner className="mb-2">{error}</FormErrorBanner>}
        {extra && <div className="mb-2">{extra}</div>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-12" onClick={onCancel} disabled={saveLoading}>Cancel</Button>
          <Button className="flex-[2] h-12 text-base" onClick={onSave} disabled={saveDisabled} loading={saveLoading}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </>
  )
}
