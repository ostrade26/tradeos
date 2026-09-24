import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

/** Hover delay so brief passes don’t flash the tip. */
export const DELAYED_TOOLTIP_OPEN_MS = 500
const VIEWPORT_PAD = 8
const GAP = 8
const FADE_MS = 150

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

function placeTooltip(
  trigger: DOMRect,
  tipW: number,
  tipH: number,
): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const centerX = trigger.left + trigger.width / 2

  let left = centerX - tipW / 2
  left = clamp(left, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, vw - tipW - VIEWPORT_PAD))

  const spaceAbove = trigger.top - VIEWPORT_PAD
  const spaceBelow = vh - trigger.bottom - VIEWPORT_PAD
  const preferAbove = spaceAbove >= tipH + GAP || spaceAbove >= spaceBelow

  let top = preferAbove ? trigger.top - GAP - tipH : trigger.bottom + GAP
  top = clamp(top, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, vh - tipH - VIEWPORT_PAD))

  return { top, left }
}

/** Delayed, viewport-aware hover tooltip with a short fade. */
export function DelayedHoverTooltip({
  enabled,
  content,
  children,
  className,
  tipClassName,
}: {
  enabled: boolean
  content: ReactNode
  children: ReactNode
  className?: string
  tipClassName?: string
}) {
  const tipId = useId()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const clearTimers = () => {
    if (openTimerRef.current != null) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const close = () => {
    clearTimers()
    setVisible(false)
    closeTimerRef.current = setTimeout(() => {
      setMounted(false)
      setPos(null)
      closeTimerRef.current = null
    }, FADE_MS)
  }

  const scheduleOpen = () => {
    if (!enabled) return
    clearTimers()
    openTimerRef.current = setTimeout(() => {
      setMounted(true)
      openTimerRef.current = null
    }, DELAYED_TOOLTIP_OPEN_MS)
  }

  useEffect(() => () => clearTimers(), [])

  useLayoutEffect(() => {
    if (!mounted || !enabled) return
    const trigger = triggerRef.current
    const tip = tipRef.current
    if (!trigger || !tip) return

    const update = () => {
      const tr = trigger.getBoundingClientRect()
      const { width, height } = tip.getBoundingClientRect()
      setPos(placeTooltip(tr, width, height))
    }

    update()
    const raf = requestAnimationFrame(() => setVisible(true))

    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [mounted, enabled, content])

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('min-w-0', className)}
        tabIndex={enabled ? 0 : undefined}
        aria-describedby={mounted && pos ? tipId : undefined}
        onMouseEnter={scheduleOpen}
        onMouseLeave={close}
        onFocus={scheduleOpen}
        onBlur={close}
      >
        {children}
      </span>
      {mounted
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className={cn(
                'pointer-events-none fixed z-[4000] max-w-[16rem]',
                'rounded-md border border-gray-200 bg-card px-3 py-2 text-left shadow-[var(--shadow-md)]',
                'dark:border-gray-700',
                'transition-[opacity,transform] duration-150 ease-out',
                'motion-reduce:transition-none',
                visible && pos
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-0.5',
                tipClassName,
              )}
              style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

/** Truncated text that only shows a delayed tooltip when the value is actually clipped. */
export function TruncatedTextWithTooltip({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [truncated, setTruncated] = useState(false)
  const value = text?.trim() ?? ''

  const measure = () => {
    const el = textRef.current
    if (!el) return
    setTruncated(el.scrollWidth > el.clientWidth + 1)
  }

  useLayoutEffect(() => {
    measure()
  }, [value])

  useEffect(() => {
    const el = textRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [value])

  return (
    <DelayedHoverTooltip
      enabled={truncated && Boolean(value)}
      content={<p className="text-xs text-heading leading-snug break-words">{value}</p>}
      className="block max-w-full"
    >
      <span ref={textRef} className={cn('block truncate', className)}>
        {value || '—'}
      </span>
    </DelayedHoverTooltip>
  )
}
