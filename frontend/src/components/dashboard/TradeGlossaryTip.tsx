import { useState } from 'react'
import { storageGet, storageSet } from '../../lib/storage'
import { X } from 'lucide-react'

const STORAGE_KEY = 'tradeal.glossary-tip.dismissed'

export function TradeGlossaryTip() {
  const [hidden, setHidden] = useState(() => {
    try {
      return storageGet(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  if (hidden) return null

  const dismiss = () => {
    try {
      storageSet(STORAGE_KEY, '1')
    } catch {
      /* ignore quota / private mode */
    }
    setHidden(true)
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">How Tradeal uses these words</p>
          <dl className="mt-2 grid gap-1.5 text-sm text-heading sm:grid-cols-2">
            <div>
              <dt className="font-medium">Ready to lift</dt>
              <dd className="text-muted text-xs mt-0.5 leading-relaxed">Order qty not yet on a lift (unlifted).</dd>
            </div>
            <div>
              <dt className="font-medium">In transit</dt>
              <dd className="text-muted text-xs mt-0.5 leading-relaxed">Lift recorded; tanker dispatched, not marked delivered.</dd>
            </div>
            <div>
              <dt className="font-medium">Delivered</dt>
              <dd className="text-muted text-xs mt-0.5 leading-relaxed">Actual weight confirmed at destination.</dd>
            </div>
            <div>
              <dt className="font-medium">Spot · MT</dt>
              <dd className="text-muted text-xs mt-0.5 leading-relaxed">Spot is loading/delivery location. MT is metric tons.</dd>
            </div>
          </dl>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-gray-200 hover:text-heading dark:hover:bg-gray-700 cursor-pointer attex-focus"
          aria-label="Dismiss glossary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
