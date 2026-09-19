import { useState } from 'react'
import { Info } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'

const GLOSSARY_ITEMS = [
  {
    term: 'Ready to lift',
    detail: 'Order qty not yet on a lift (unlifted).',
  },
  {
    term: 'In transit',
    detail: 'Lift recorded; tanker dispatched, not marked delivered.',
  },
  {
    term: 'Delivered',
    detail: 'Actual weight confirmed at destination.',
  },
  {
    term: 'Spot · MT',
    detail: 'Spot is loading/delivery location. MT is metric tons.',
  },
] as const

export function TradeGlossaryTip() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-gray-800 cursor-pointer attex-focus"
        aria-label="How Tradeal uses these words"
        title="How Tradeal uses these words"
      >
        <Info className="h-4 w-4" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="How Tradeal uses these words"
        subtitle="Common terms on your dashboard and registers"
        size="md"
        footer={
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <dl className="divide-y divide-gray-200 dark:divide-gray-700">
          {GLOSSARY_ITEMS.map(item => (
            <div key={item.term} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <dt className="text-sm font-medium text-heading">{item.term}</dt>
              <dd className="text-sm text-muted leading-relaxed">{item.detail}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </>
  )
}
