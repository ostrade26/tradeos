import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronsRight, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

const HANDLE = 36
const INSET = 4
const THRESHOLD = 0.88

export function SwipeToConfirm({
  label = 'Slide to delete',
  onConfirm,
  disabled = false,
  loading = false,
}: {
  label?: string
  onConfirm: () => void | Promise<void>
  disabled?: boolean
  loading?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startProgressRef = useRef(0)
  const progressRef = useRef(0)
  const confirmedRef = useRef(false)
  const labelId = useId()
  const [progress, setProgressState] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [maxTravel, setMaxTravel] = useState(0)

  const setProgress = (next: number) => {
    progressRef.current = next
    setProgressState(next)
  }

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const measure = () => setMaxTravel(Math.max(0, el.clientWidth - HANDLE - INSET * 2))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    confirmedRef.current = false
    setProgress(0)
    setDragging(false)
  }, [label])

  const finishIfReady = useCallback(
    async (next: number) => {
      if (confirmedRef.current || disabled || loading) return
      if (next >= THRESHOLD) {
        confirmedRef.current = true
        setProgress(1)
        try {
          await onConfirm()
        } catch {
          confirmedRef.current = false
          setProgress(0)
        }
      } else {
        setProgress(0)
      }
    },
    [disabled, loading, onConfirm],
  )

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || loading || confirmedRef.current) return
    draggingRef.current = true
    setDragging(true)
    startXRef.current = event.clientX
    startProgressRef.current = progress
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return
    const max = maxTravel
    if (max <= 0) return
    const next = Math.min(1, Math.max(0, startProgressRef.current + (event.clientX - startXRef.current) / max))
    setProgress(next)
  }

  const onPointerUp = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    void finishIfReady(progressRef.current)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || loading || confirmedRef.current) return
    if (event.key === 'ArrowRight' || event.key === ' ') {
      event.preventDefault()
      const next = Math.min(1, progress + 0.2)
      setProgress(next)
      if (next >= THRESHOLD) void finishIfReady(next)
    }
    if (event.key === 'ArrowLeft' || event.key === 'Home') {
      event.preventDefault()
      setProgress(0)
    }
  }

  const locked = loading || confirmedRef.current
  const fill = locked ? 1 : progress
  const x = fill * maxTravel

  return (
    <div
      ref={trackRef}
      className="relative h-11 w-full select-none overflow-hidden rounded-md bg-danger"
    >
      <p
        id={labelId}
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-center px-12 text-sm font-medium text-white',
          'transition-opacity duration-150 motion-reduce:transition-none',
        )}
        style={{ opacity: locked ? 0 : 1 - fill * 1.15 }}
      >
        {label}
      </p>
      <button
        type="button"
        disabled={disabled || loading}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill * 100)}
        role="slider"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          'absolute top-1 left-1 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md',
          'bg-white text-danger shadow-sm attex-focus cursor-grab touch-none',
          'disabled:cursor-not-allowed',
          dragging && 'cursor-grabbing',
          !dragging && 'transition-transform duration-200 ease-out motion-reduce:transition-none',
        )}
        style={{ transform: `translateX(${x}px)` }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : locked ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronsRight className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  )
}
