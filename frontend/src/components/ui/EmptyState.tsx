import { cn } from '../../lib/utils'

export function EmptyState({
  description,
  className,
}: {
  description: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-gray-200 dark:border-gray-700 px-4 py-5 text-center',
        className,
      )}
    >
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </div>
  )
}
