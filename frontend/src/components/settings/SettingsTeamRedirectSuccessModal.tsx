import { Users } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Drawer'

/** Success prompt after creating a team user (credentials follow separately). */
export function SettingsTeamRedirectSuccessModal({
  open,
  onClose,
  title,
  description,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button onClick={onClose}>
            <Users className="h-4 w-4" aria-hidden />
            Done
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </Modal>
  )
}
