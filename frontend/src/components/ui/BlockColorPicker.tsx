import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import {
  BLOCK_COLOR_ROWS,
  SURFACE_COLOR_ROWS,
  hasGoodAccentContrast,
  normalizeHex,
} from '../../lib/accentColor'
import { popoverPlacementClass, useFlipPopover } from '../../hooks/useFlipPopover'
import { onOutsideClick } from '../../lib/outsideClick'

interface BlockColorPickerProps {
  value: string
  onChange: (hex: string) => void
  /** Selected styling on the trigger (e.g. when custom accent is active). */
  selected?: boolean
  /**
   * `accent` — dark swatches with white-text contrast (brand accent).
   * `surface` — light / soft swatches for card backgrounds.
   */
  palette?: 'accent' | 'surface'
  className?: string
  'aria-label'?: string
}

export function BlockColorPicker({
  value,
  onChange,
  selected = false,
  palette = 'accent',
  className,
  'aria-label': ariaLabel = 'Pick a colour',
}: BlockColorPickerProps) {
  const autoId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const placement = useFlipPopover(open, triggerRef, panelRef)
  const current = normalizeHex(value)
  const rows = palette === 'surface' ? SURFACE_COLOR_ROWS : BLOCK_COLOR_ROWS
  const isSurface = palette === 'surface'

  useEffect(() => {
    if (!open) return
    return onOutsideClick(e => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const pick = (hex: string) => {
    const next = normalizeHex(hex)
    if (!isSurface && !hasGoodAccentContrast(next)) return
    onChange(next)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        id={autoId}
        type="button"
        title="Custom colour"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-pressed={selected}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'relative h-8 w-8 rounded-full cursor-pointer overflow-hidden attex-focus border-2',
          isSurface && !selected ? 'border-gray-200 dark:border-gray-600' : 'border-transparent',
          selected
            ? 'ring-2 ring-offset-2 ring-heading dark:ring-offset-[var(--color-card)] scale-105'
            : 'opacity-90 hover:opacity-100 hover:scale-105',
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: selected
              ? current
              : isSurface
                ? 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 35%, #dbeafe 65%, #fce7f3 100%)'
                : 'conic-gradient(from 180deg, #b91c1c, #b85c00, #1b7a34, #0a66c2, #7e22ce, #be185d, #b91c1c)',
          }}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Colour palette"
          className={cn(
            'absolute right-0 z-50 w-[min(100vw-2rem,17.5rem)] rounded-xl border border-gray-200 bg-white p-2.5 shadow-xl',
            'dark:border-gray-600 dark:bg-zinc-900',
            popoverPlacementClass(placement),
          )}
        >
          <p className="px-0.5 pb-2 text-[11px] font-medium text-muted">
            {isSurface ? 'Light backgrounds' : 'Colours with good contrast'}
          </p>
          <div className="space-y-1.5">
            {rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
              >
                {row.map(hex => {
                  const active = current === normalizeHex(hex)
                  const needsBorder = isSurface && relativeIsNearWhite(hex)
                  return (
                    <button
                      key={hex}
                      type="button"
                      title={hex.toUpperCase()}
                      aria-label={`Colour ${hex}`}
                      aria-pressed={active}
                      onClick={() => pick(hex)}
                      className={cn(
                        'aspect-square w-full rounded-[3px] cursor-pointer transition-transform attex-focus',
                        'hover:scale-110 hover:z-10',
                        needsBorder && 'ring-1 ring-inset ring-black/10',
                        active && 'ring-2 ring-offset-1 ring-heading dark:ring-offset-zinc-900 scale-105',
                      )}
                      style={{ backgroundColor: hex }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <p className="mt-2 px-0.5 text-[10px] tabular-nums text-muted">
            {current.toUpperCase()}
          </p>
        </div>
      )}
    </div>
  )
}

function relativeIsNearWhite(hex: string): boolean {
  const n = normalizeHex(hex).replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return (r + g + b) / 3 > 230
}
