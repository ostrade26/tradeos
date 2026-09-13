import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface DropdownPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: (props: { ref: React.RefObject<HTMLButtonElement | null>; onClick: () => void; 'aria-expanded': boolean }) => ReactNode
  children: ReactNode
  width?: number
  align?: 'left' | 'right'
  className?: string
}

export function DropdownPanel({
  open,
  onOpenChange,
  trigger,
  children,
  width = 320,
  align = 'right',
  className,
}: DropdownPanelProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null)

  const syncMenuPosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const gap = 6
    const menuHeight = menuRef.current?.offsetHeight ?? 360

    let top = rect.bottom + gap
    let left = align === 'right' ? rect.right - width : rect.left

    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - gap
    }
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    top = Math.max(8, top)

    setMenuStyle({ top, left })
  }, [align, width])

  useEffect(() => {
    if (!open) {
      setMenuStyle(null)
      return
    }
    syncMenuPosition()
    const onScrollOrResize = () => syncMenuPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
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
          style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, width, zIndex: 70 }}
          className={className ?? 'rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-lg overflow-hidden'}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  )
}
