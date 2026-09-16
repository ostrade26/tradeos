import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
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
    <Modal
      open={open}
      onClose={onClose}
      title={PLATFORM_WHATS_NEW.title}
      subtitle={`Version ${PLATFORM_WHATS_NEW.version} is on the live platform.`}
      size="md"
      footer={
        <Button type="button" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <ul className="space-y-4">
        {PLATFORM_WHATS_NEW.items.map(item => (
          <li key={item.title}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {platformWhatsNewCategoryLabel(item.category)}
            </p>
            <p className="text-sm font-medium text-heading mt-1">{item.title}</p>
            <p className="text-sm text-muted mt-1 leading-relaxed">{item.detail}</p>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
