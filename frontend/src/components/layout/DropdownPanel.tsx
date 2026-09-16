import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type DropdownPanelPlacement = 'trigger' | 'aboveDetailPanel'

interface DropdownPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: (props: { ref: React.RefObject<HTMLButtonElement | null>; onClick: () => void; 'aria-expanded': boolean }) => ReactNode
  children: ReactNode
  width?: number
  align?: 'left' | 'right'
  /** When `aboveDetailPanel`, anchors over the docked right column (falls back to trigger). */
  placement?: DropdownPanelPlacement
  zIndex?: number
  className?: string
}

export function DropdownPanel({
  open,
  onOpenChange,
  trigger,
  children,
  width = 320,
  align = 'right',
  placement = 'trigger',
  zIndex = 70,
  className,
}: DropdownPanelProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null)

  const syncMenuPosition = useCallback(() => {
    const gap = 8
    const menuHeight = menuRef.current?.offsetHeight ?? 360
    let panelWidth = width

    if (placement === 'aboveDetailPanel') {
      const panel = document.querySelector('aside.app-detail-panel')
      const panelRect = panel?.getBoundingClientRect()
      if (panelRect && panelRect.width > 8) {
        panelWidth = Math.min(width, Math.max(280, panelRect.width - gap * 2))
        const left = panelRect.left + (panelRect.width - panelWidth) / 2
        let top = panelRect.top - menuHeight - gap
        const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? panelRect.top
        if (top < headerBottom) {
          top = Math.min(panelRect.top + gap, window.innerHeight - menuHeight - gap)
        }
        setMenuStyle({
          top: Math.max(8, top),
          left: Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8)),
          width: panelWidth,
        })
        return
      }
      const page = document.querySelector('.page-content')
      const pageRect = page?.getBoundingClientRect()
      if (pageRect) {
        panelWidth = Math.min(width, 448)
        const left = pageRect.right - panelWidth - gap
        const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? pageRect.top
        let top = headerBottom + gap
        if (top + menuHeight > window.innerHeight - 8) {
          top = window.innerHeight - menuHeight - gap
        }
        setMenuStyle({
          top: Math.max(8, top),
          left: Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8)),
          width: panelWidth,
        })
        return
      }
    }

    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()

    let top = rect.bottom + gap
    let left = align === 'right' ? rect.right - panelWidth : rect.left

    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - gap
    }
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8))
    top = Math.max(8, top)

    setMenuStyle({ top, left, width: panelWidth })
  }, [align, placement, width])

  useEffect(() => {
    if (!open) {
      setMenuStyle(null)
      return
    }
    syncMenuPosition()
    const raf = requestAnimationFrame(() => syncMenuPosition())
    const onScrollOrResize = () => syncMenuPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    const panel = document.querySelector('aside.app-detail-panel')
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScrollOrResize) : null
    if (panel) ro?.observe(panel)
    const menuEl = menuRef.current
    if (menuEl) ro?.observe(menuEl)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      ro?.disconnect()
    }
  }, [open, syncMenuPosition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      onOpenChange(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, onOpenChange])

  return (
    <>
      {trigger({
        ref: buttonRef,
        onClick: () => onOpenChange(!open),
        'aria-expanded': open,
      })}
      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, zIndex }}
          className={className ?? 'rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-lg overflow-hidden'}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  )
}
