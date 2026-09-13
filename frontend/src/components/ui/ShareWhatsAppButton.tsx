import { Share2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface ShareWhatsAppButtonProps {
  onShare: () => void
  className?: string
  size?: 'sm' | 'default'
  fullWidth?: boolean
  label?: string
}

export function ShareWhatsAppButton({
  onShare,
  className,
  size = 'default',
  fullWidth = false,
  label = 'Share on WhatsApp',
}: ShareWhatsAppButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size === 'sm' ? 'sm' : 'md'}
      className={cn(
        'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800',
        'dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30',
        fullWidth && 'w-full',
        className,
      )}
      onClick={onShare}
    >
      <Share2 className="h-4 w-4" />
      {label}
    </Button>
  )
}
