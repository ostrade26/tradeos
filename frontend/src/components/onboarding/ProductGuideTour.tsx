import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import type { ProductGuideTourStep } from '../../lib/productGuideTour'

interface Props {
  open: boolean
  steps: ProductGuideTourStep[]
  onComplete: () => void
  onSkip: () => void
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const SPOTLIGHT_PAD = 8
/** Flat dim overlay only — no backdrop-filter / frost on the tour scrim. */
const SCRIM_RGBA = 'rgba(0, 0, 0, 0.55)'
const EASE = 'cubic-bezier(0.33, 1, 0.68, 1)'
const MOVE_MS = 560

function measureTarget(selector: string): Rect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function paddedRect(rect: Rect): Rect {
  return {
    top: rect.top - SPOTLIGHT_PAD,
    left: rect.left - SPOTLIGHT_PAD,
    width: rect.width + SPOTLIGHT_PAD * 2,
    height: rect.height + SPOTLIGHT_PAD * 2,
  }
}

function useSpotlightHole(open: boolean, targetSelector: string | undefined) {
  const [hole, setHole] = useState<Rect | null>(null)

  useLayoutEffect(() => {
    if (!open || !targetSelector) {
      setHole(null)
      return
    }

    const applyMeasure = () => {
      const next = measureTarget(targetSelector)
      if (!next) return
      const padded = paddedRect(next)
      setHole(prev => {
        if (
          prev &&
          Math.abs(prev.top - padded.top) < 0.5 &&
          Math.abs(prev.left - padded.left) < 0.5 &&
          Math.abs(prev.width - padded.width) < 0.5 &&
          Math.abs(prev.height - padded.height) < 0.5
        ) {
          return prev
        }
        return padded
      })
    }

    applyMeasure()

    const el = document.querySelector(targetSelector)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })

    let raf = 0
    const start = performance.now()
    const trackScroll = (now: number) => {
      applyMeasure()
      if (now - start < MOVE_MS + 120) {
        raf = requestAnimationFrame(trackScroll)
      }
    }
    raf = requestAnimationFrame(trackScroll)

    const resize = () => applyMeasure()
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', resize, true)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', resize, true)
    }
  }, [open, targetSelector])

  return hole
}

function BackdropClickPanels({
  hole,
  viewportW,
  viewportH,
  onSkip,
}: {
  hole: Rect
  viewportW: number
  viewportH: number
  onSkip: () => void
}) {
  const { top, left, width, height } = hole
  const right = left + width
  const bottom = top + height
  const panel = 'absolute cursor-pointer'

  return (
    <>
      <div aria-hidden className={panel} style={{ top: 0, left: 0, width: viewportW, height: top }} onClick={onSkip} />
      <div aria-hidden className={panel} style={{ top, left: 0, width: left, height }} onClick={onSkip} />
      <div
        aria-hidden
        className={panel}
        style={{ top, left: right, width: Math.max(0, viewportW - right), height }}
        onClick={onSkip}
      />
      <div
        aria-hidden
        className={panel}
        style={{ top: bottom, left: 0, width: viewportW, height: Math.max(0, viewportH - bottom) }}
        onClick={onSkip}
      />
    </>
  )
}

/** Dim outside the hole only — transparent center, no layer over the target (stays sharp). */
function TourBackdrop({
  hole,
  viewportW,
  viewportH,
  onSkip,
}: {
  hole: Rect | null
  viewportW: number
  viewportH: number
  onSkip: () => void
}) {
  if (!hole) {
    return (
      <div
        aria-hidden
        className="fixed inset-0 cursor-pointer"
        style={{ backgroundColor: SCRIM_RGBA }}
        onClick={onSkip}
      />
    )
  }

  return (
    <>
      <div
        aria-hidden
        className="product-tour-scrim-hole pointer-events-none fixed left-0 top-0 rounded-[10px]"
        style={{
          transform: `translate3d(${hole.left}px, ${hole.top}px, 0)`,
          width: hole.width,
          height: hole.height,
          boxShadow: `0 0 0 9999px ${SCRIM_RGBA}`,
        }}
      />
      <BackdropClickPanels hole={hole} viewportW={viewportW} viewportH={viewportH} onSkip={onSkip} />
    </>
  )
}

export function ProductGuideTour({ open, steps, onComplete, onSkip }: Props) {
  const [index, setIndex] = useState(0)
  const [entered, setEntered] = useState(false)
  const step = steps[index]
  const isLast = index >= steps.length - 1
  const hole = useSpotlightHole(open, step?.target)

  useEffect(() => {
    if (!open) {
      setIndex(0)
      setEntered(false)
      return
    }
    const t = window.requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(t)
  }, [open])

  if (!open || !step || steps.length === 0) return null

  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  const tooltipTop = hole
    ? Math.min(hole.top + hole.height + 16, viewportH - 220)
    : viewportH / 2 - 100
  const tooltipLeft = hole
    ? Math.min(Math.max(16, hole.left), viewportW - 320)
    : Math.max(16, (viewportW - 304) / 2)

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[3500]',
        entered ? 'opacity-100' : 'opacity-0',
        'transition-opacity duration-500 ease-out',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-tour-title"
    >
      <TourBackdrop hole={hole} viewportW={viewportW} viewportH={viewportH} onSkip={onSkip} />
      {hole ? (
        <div
          aria-hidden
          className={cn(
            'product-tour-ring pointer-events-none fixed left-0 top-0 z-[1] rounded-[10px]',
            'ring-2 ring-accent/80 ring-offset-0',
          )}
          style={{
            transform: `translate3d(${hole.left}px, ${hole.top}px, 0)`,
            width: hole.width,
            height: hole.height,
          }}
        />
      ) : null}

      <div
        className={cn(
          'product-tour-tooltip-shell absolute z-[2] w-[min(20rem,calc(100vw-2rem))]',
          !hole && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        )}
        style={
          hole
            ? {
                top: tooltipTop,
                left: tooltipLeft,
              }
            : undefined
        }
      >
        <div className="rounded-md bg-accent p-5 text-white shadow-[var(--shadow-md)] border border-white/10">
          <div key={index} className="product-tour-step-copy">
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">
              Product guide · {index + 1} of {steps.length}
            </p>
            <h2 id="product-tour-title" className="text-base font-semibold text-white mt-1">
              {step.title}
            </h2>
            <p className="text-sm text-white/85 mt-2 leading-relaxed">{step.body}</p>
            {!hole ? (
              <p className="text-xs text-white/75 mt-2">Open the menu on smaller screens to see this item.</p>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2 mt-5">
            <button
              type="button"
              className="text-sm font-medium text-white/75 hover:text-white cursor-pointer rounded-md px-1 py-0.5 -ml-1 outline-none focus:outline-none focus-visible:outline-none"
              onClick={onSkip}
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {index > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/40 bg-white text-accent hover:bg-white/90 hover:text-accent-hover hover:border-white/60 dark:bg-white dark:text-accent dark:hover:bg-white/90 dark:hover:text-accent-hover"
                  onClick={() => setIndex(i => i - 1)}
                >
                  Back
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-transparent bg-white text-accent hover:bg-white/90 hover:text-accent-hover shadow-sm dark:bg-white dark:text-accent dark:hover:bg-white/90 dark:hover:text-accent-hover"
                onClick={() => {
                  if (isLast) onComplete()
                  else setIndex(i => i + 1)
                }}
              >
                {isLast ? 'Done' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .product-tour-scrim-hole,
        .product-tour-ring {
          transition:
            transform ${MOVE_MS}ms ${EASE},
            width ${MOVE_MS}ms ${EASE},
            height ${MOVE_MS}ms ${EASE},
            box-shadow ${MOVE_MS}ms ${EASE};
          will-change: transform, width, height;
        }
        .product-tour-tooltip-shell {
          transition:
            top ${MOVE_MS}ms ${EASE},
            left ${MOVE_MS}ms ${EASE},
            opacity 400ms ease-out;
        }
        @keyframes productTourStepCopy {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .product-tour-step-copy {
          animation: productTourStepCopy 320ms ${EASE} both;
        }
      `}</style>
    </div>,
    document.body,
  )
}
