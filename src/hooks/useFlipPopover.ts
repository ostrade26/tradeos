import { useLayoutEffect, useState, type RefObject } from 'react'

export type PopoverPlacement = 'above' | 'below'

const GAP_PX = 6

/**
 * Flip a popover above or below its anchor based on viewport space.
 * Re-measures on scroll (capture) and resize while open.
 */
export function useFlipPopover(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
): PopoverPlacement {
  const [placement, setPlacement] = useState<PopoverPlacement>('below')

  useLayoutEffect(() => {
    if (!open) {
      setPlacement('below')
      return
    }

    const measure = () => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor || !panel) return

      const anchorRect = anchor.getBoundingClientRect()
      const panelHeight = panel.offsetHeight
      const spaceBelow = window.innerHeight - anchorRect.bottom - GAP_PX
      const spaceAbove = anchorRect.top - GAP_PX

      setPlacement(
        spaceBelow >= panelHeight || spaceBelow >= spaceAbove ? 'below' : 'above',
      )
    }

    measure()
    const raf = requestAnimationFrame(measure)

    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...deps])

  return placement
}

export function popoverPlacementClass(placement: PopoverPlacement) {
  return placement === 'below' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
}
