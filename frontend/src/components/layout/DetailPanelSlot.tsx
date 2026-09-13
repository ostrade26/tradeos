import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { cn } from '../../lib/utils'

type DetailPanelWidth = 'sm' | 'md' | 'lg'

const dockedWidths: Record<DetailPanelWidth, string> = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[28rem]',
}

interface DetailPanelSlotContextValue {
  containerRef: RefObject<HTMLDivElement | null>
  open: boolean
  width: DetailPanelWidth
  setOpen: (open: boolean, width?: DetailPanelWidth) => void
}

const DetailPanelSlotContext = createContext<DetailPanelSlotContextValue | null>(null)

export function DetailPanelSlotProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpenState] = useState(false)
  const [width, setWidth] = useState<DetailPanelWidth>('lg')

  const setOpen = useCallback((next: boolean, nextWidth: DetailPanelWidth = 'lg') => {
    setOpenState(next)
    if (next) setWidth(nextWidth)
  }, [])

  const value = useMemo(
    () => ({ containerRef, open, width, setOpen }),
    [open, width, setOpen],
  )

  return (
    <DetailPanelSlotContext.Provider value={value}>
      {children}
    </DetailPanelSlotContext.Provider>
  )
}

export function useDetailPanelSlot() {
  const ctx = useContext(DetailPanelSlotContext)
  if (!ctx) throw new Error('useDetailPanelSlot must be used within DetailPanelSlotProvider')
  return ctx
}

/** Right detail column — lives inside page-content below the navbar */
export function DetailPanelColumn() {
  const { containerRef, open, width } = useDetailPanelSlot()

  return (
    <aside
      className={cn(
        'app-detail-panel shrink-0 flex-col overflow-hidden z-[1000]',
        'h-viewport-under-topbar max-h-viewport-under-topbar',
        'border-l border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-card',
        dockedWidths[width],
        open ? 'hidden lg:flex' : 'hidden',
      )}
    >
      <div ref={containerRef} className="flex h-full min-h-0 flex-col overflow-hidden" />
    </aside>
  )
}

export function useDetailPanelDockedOpen() {
  const { open } = useDetailPanelSlot()
  return open
}
