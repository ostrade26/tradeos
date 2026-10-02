import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

type Step = { id: string; label: string; short: string; done: boolean }

function confirmationSteps(
  role: string,
  buyerConfirmed: boolean,
  sellerConfirmed: boolean,
): Step[] {
  if (role === 'buyer') {
    return [
      { id: 'received', label: 'Contract received', short: 'Received', done: true },
      { id: 'you', label: 'Your confirmation', short: 'You', done: buyerConfirmed },
      { id: 'other', label: 'Seller confirmation', short: 'Seller', done: sellerConfirmed },
    ]
  }
  if (role === 'seller') {
    return [
      { id: 'received', label: 'Contract received', short: 'Received', done: true },
      { id: 'you', label: 'Your confirmation', short: 'You', done: sellerConfirmed },
      { id: 'other', label: 'Buyer confirmation', short: 'Buyer', done: buyerConfirmed },
    ]
  }
  return [
    { id: 'sent', label: 'Contract sent', short: 'Sent', done: true },
    { id: 'buyer', label: 'Buyer confirmation', short: 'Buyer', done: buyerConfirmed },
    { id: 'seller', label: 'Seller confirmation', short: 'Seller', done: sellerConfirmed },
  ]
}

export function ConfirmationProgress({
  buyerConfirmed,
  sellerConfirmed,
  role = 'broker',
  compact = false,
}: {
  buyerConfirmed: boolean
  sellerConfirmed: boolean
  role?: string
  compact?: boolean
}) {
  const steps = confirmationSteps(role, buyerConfirmed, sellerConfirmed)

  return (
    <ol className="grid grid-cols-3" aria-label="Contract confirmation">
      {steps.map((step, index) => {
        const leftDone = index > 0 && steps[index - 1].done && step.done
        const rightDone = index < steps.length - 1 && step.done && steps[index + 1].done
        return (
          <li key={step.id} className="relative flex flex-col items-center text-center">
            {index > 0 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute right-1/2 left-0',
                  compact ? 'top-[7px]' : 'top-2',
                  leftDone
                    ? 'h-px bg-accent'
                    : 'border-t border-dashed border-gray-300 dark:border-gray-600',
                )}
              />
            ) : null}
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute right-0 left-1/2',
                  compact ? 'top-[7px]' : 'top-2',
                  rightDone
                    ? 'h-px bg-accent'
                    : 'border-t border-dashed border-gray-300 dark:border-gray-600',
                )}
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 flex items-center justify-center rounded-full',
                compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
                step.done
                  ? 'bg-accent text-white'
                  : 'border border-gray-300 bg-white dark:border-gray-600 dark:bg-card',
              )}
            >
              {step.done ? <Check className={compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} strokeWidth={2.5} /> : null}
            </span>
            <span
              className={cn(
                'mt-2 leading-snug',
                compact ? 'text-[11px]' : 'max-w-[7.5rem] text-xs',
                step.done ? 'font-medium text-heading' : 'text-muted',
              )}
            >
              {compact ? step.short : step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
