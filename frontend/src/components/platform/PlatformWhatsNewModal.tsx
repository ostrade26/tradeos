import { Button } from '../ui/Button'
import { AnnouncementModalShell } from '../feedback/AnnouncementModalShell'
import {
  PLATFORM_WHATS_NEW,
  platformWhatsNewCategoryLabel,
} from '../../lib/platformWhatsNew'

export function PlatformWhatsNewModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <AnnouncementModalShell
      open={open}
      onClose={onClose}
      variant="release"
      title={PLATFORM_WHATS_NEW.title}
      subtitle="Review what's new on the live platform console."
      version={PLATFORM_WHATS_NEW.version}
      badgeLabel="Platform release"
      footer={
        <Button type="button" className="min-h-11 px-8 text-base font-semibold" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <ul className="space-y-4 text-left">
        {PLATFORM_WHATS_NEW.items.map(item => (
          <li key={item.title} className="rounded-lg border border-gray-200/80 px-4 py-3 dark:border-gray-700">
            <p className="text-xs font-bold uppercase tracking-wide text-accent">
              {platformWhatsNewCategoryLabel(item.category)}
            </p>
            <p className="mt-1 text-sm font-semibold text-heading">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{item.detail}</p>
          </li>
        ))}
      </ul>
    </AnnouncementModalShell>
  )
}
