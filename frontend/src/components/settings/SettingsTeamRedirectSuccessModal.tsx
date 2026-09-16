import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { settingsPath } from '../../lib/settingsSections'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Drawer'

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
  const navigate = useNavigate()

  const goToTeam = () => {
    onClose()
    navigate(settingsPath('team'))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={goToTeam}>
            <Users className="h-4 w-4" aria-hidden />
            Go to Team
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </Modal>
  )
}
