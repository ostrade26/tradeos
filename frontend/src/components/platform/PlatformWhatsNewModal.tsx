import { Button } from '../ui/Button'
import { AnnouncementModalShell } from '../feedback/AnnouncementModalShell'
import {
  PLATFORM_WHATS_NEW,
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
      variant="generalAnnouncement"
      title="General Announcement"
      subtitle="Review what's new on the live platform console."
      footer={
        <Button type="button" className="min-h-11 px-8 font-semibold" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <div className="space-y-5 text-left">
        {PLATFORM_WHATS_NEW.items.map(item => (
          <section key={item.title} className="space-y-2">
            <h3 className="text-base font-semibold text-heading leading-snug">{item.title}</h3>
            <p className="text-sm leading-relaxed text-heading/90">{item.detail}</p>
          </section>
        ))}
      </div>
    </AnnouncementModalShell>
  )
}
