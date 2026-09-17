import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { ProductRequestAttachment } from '../../api/platformApi'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/bodyScrollLock'
import { cn } from '../../lib/utils'

/** Above Modal/Drawer (1200) and toasts (1300). */
const PREVIEW_Z = 1400

export function ScreenshotStrip({
  shots,
  inverted,
  onRemove,
  size = 'md',
}: {
  shots?: ProductRequestAttachment[] | null
  inverted?: boolean
  onRemove?: (index: number) => void
  size?: 'sm' | 'md'
}) {
  const [preview, setPreview] = useState<number | null>(null)
  if (!shots?.length) return null
  const dim = size === 'sm' ? 'h-16 w-16' : 'h-20 w-20'

  return (
    <>
      <div className={cn('mt-1.5 flex flex-wrap gap-2', inverted && 'justify-end')}>
        {shots.map((shot, index) => (
          <div key={`${shot.name}-${index}`} className="relative">
            <button
              type="button"
              onClick={() => setPreview(index)}
              className="block overflow-hidden rounded-xl border border-gray-200 bg-gray-100 cursor-pointer attex-focus dark:border-gray-700 dark:bg-zinc-800"
              aria-label={`View ${shot.name}`}
            >
              <img src={shot.data} alt="" className={cn(dim, 'object-cover')} />
            </button>
            {onRemove ? (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onRemove(index)
                }}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-heading text-white cursor-pointer attex-focus"
                aria-label={`Remove ${shot.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {preview != null ? (
        <ScreenshotPreview
          shots={shots}
          index={preview}
          onIndex={setPreview}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  )
}

function ScreenshotPreview({
  shots,
  index,
  onIndex,
  onClose,
}: {
  shots: ProductRequestAttachment[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const shot = shots[index]
  const many = shots.length > 1
  useFocusTrap(panelRef, true)

  useEffect(() => {
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'ArrowLeft' && many) {
        e.preventDefault()
        onIndex((index - 1 + shots.length) % shots.length)
      }
      if (e.key === 'ArrowRight' && many) {
        e.preventDefault()
        onIndex((index + 1) % shots.length)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [index, many, onClose, onIndex, shots.length])

  if (!shot) return null

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={shot.name || 'Screenshot'}
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: PREVIEW_Z }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/92 cursor-pointer"
        aria-label="Close preview"
        onClick={onClose}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 left-4 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 hover:bg-black/70 cursor-pointer attex-focus"
        aria-label="Close preview"
      >
        <X className="h-5 w-5" />
      </button>
      {many ? (
        <button
          type="button"
          onClick={() => onIndex((index - 1 + shots.length) % shots.length)}
          className="absolute left-3 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer attex-focus sm:left-6"
          aria-label="Previous screenshot"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}
      {many ? (
        <button
          type="button"
          onClick={() => onIndex((index + 1) % shots.length)}
          className="absolute right-3 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer attex-focus sm:right-6"
          aria-label="Next screenshot"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}
      <img
        src={shot.data}
        alt={shot.name}
        className="relative z-[1] max-h-[min(92dvh,100%)] max-w-[min(96vw,100%)] object-contain select-none pointer-events-none"
      />
    </div>,
    document.body,
  )
}
