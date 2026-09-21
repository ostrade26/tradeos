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
      variant="platformRelease"
      title={PLATFORM_WHATS_NEW.title}
      subtitle="Review what's new on the live platform console."
      footer={
        <Button type="button" className="min-h-11 px-8 font-semibold" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {PLATFORM_WHATS_NEW.items.map(item => (
          <li key={item.title} className="py-5 first:pt-0 last:pb-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {platformWhatsNewCategoryLabel(item.category)}
            </p>
            <p className="mt-1 text-sm font-semibold text-heading">{item.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-heading/80">{item.detail}</p>
          </li>
        ))}
      </ul>
    </AnnouncementModalShell>
  )
}
