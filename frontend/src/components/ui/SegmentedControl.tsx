import { cn } from '../../lib/utils'

export interface SegmentOption<T extends string> {
  id: T
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  /** `field` matches Input height (h-11 / sm:h-9) for filter bars. */
  size?: 'sm' | 'md' | 'field'
  ariaLabel?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5',
        size === 'field' && 'h-11 sm:h-9',
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map(option => {
        const Icon = option.icon
        const selected = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer attex-focus',
              size === 'sm' && 'px-2.5 py-1 text-xs rounded',
              size === 'md' && 'px-3 py-1.5 text-sm rounded',
              size === 'field' && 'h-full px-3 text-sm rounded',
              selected
                ? 'bg-accent text-white shadow-sm'
                : 'text-gray-500 hover:text-heading dark:text-muted',
            )}
          >
            {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
