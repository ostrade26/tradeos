import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { InfoNoteRow, type InfoNoteItem } from './InfoNoteGrid'

export interface CaptionStrip {
  label: string
  value: ReactNode
  detail?: ReactNode
  valueClassName?: string
}

function CaptionStripItem({ strip }: { strip: CaptionStrip }) {
  const hasLabel = Boolean(strip.label)
  return (
    <div className="min-w-0">
      {hasLabel && (
        <p className="text-xs font-medium text-muted">{strip.label}</p>
      )}
      <div
        className={cn(
          'text-sm text-heading',
          hasLabel && 'mt-1 font-semibold tabular-nums',
          strip.valueClassName,
        )}
      >
        {strip.value}
      </div>
      {strip.detail && (
        <p className="text-xs text-muted mt-1.5 leading-relaxed">{strip.detail}</p>
      )}
    </div>
  )
}

export function CaptionCard({
  children,
  caption,
  secondaryCaption,
  captions,
  className,
  bodyClassName,
  noteVariant = false,
}: {
  children: ReactNode
  caption?: CaptionStrip
  secondaryCaption?: CaptionStrip
  captions?: CaptionStrip[]
  className?: string
  bodyClassName?: string
  /** Match Link-to-PO info box typography; equal columns with dividers when multiple strips */
  noteVariant?: boolean
}) {
  const strips = captions ?? [caption, secondaryCaption].filter((strip): strip is CaptionStrip => !!strip)
  const noteDetail = noteVariant ? strips.find(strip => strip.detail)?.detail : undefined

  return (
    <div className={cn('rounded-md bg-card shadow-[var(--shadow-card)] overflow-hidden', className)}>
      <div className={cn('p-8', bodyClassName)}>{children}</div>
      {strips.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-100/90 px-8 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          {noteVariant ? (
            <>
              <InfoNoteRow items={strips as InfoNoteItem[]} />
              {noteDetail && (
                <p className="text-sm text-caption mt-3 leading-relaxed">{noteDetail}</p>
              )}
            </>
          ) : (
            <div
              className={cn(
                strips.length === 2
                  ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
                  : 'flex flex-wrap gap-x-8 gap-y-3',
              )}
            >
              {strips.map((strip, index) => (
                <CaptionStripItem key={strip.label || `caption-${index}`} strip={strip} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
