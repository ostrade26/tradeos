import { useEffect, useState } from 'react'
import { Armchair } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { QtyInput } from '../ui/QtyInput'
import { Select } from '../ui/Select'
import { ORG_SEAT_TYPE_OPTIONS, type OrgSeatType } from '../../lib/platformLabels'

export function PlatformAddSeatModal({
  open,
  onClose,
  organisationName,
  loading,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  organisationName: string
  loading: boolean
  onSubmit: (payload: { count: number; seat_type: OrgSeatType }) => void
}) {
  const [count, setCount] = useState(1)
  const [seatType, setSeatType] = useState<OrgSeatType>('operator')

  useEffect(() => {
    if (open) {
      setCount(1)
      setSeatType('operator')
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add seat"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={() => onSubmit({ count, seat_type: seatType })}>
            <Armchair className="h-4 w-4" aria-hidden />
            Add seat
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted mb-4">
        Grant a licensed seat for <span className="font-medium text-heading">{organisationName}</span>.
        The organisation decides who uses it.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          searchable={false}
          label="Seat type"
          options={ORG_SEAT_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          value={seatType}
          onChange={e => setSeatType(e.target.value as OrgSeatType)}
        />
        <QtyInput
          label="Count"
          value={String(count)}
          onChange={e => {
            const digits = e.target.value.replace(/\D/g, '')
            if (!digits) {
              setCount(1)
              return
            }
            setCount(Math.max(1, Math.min(20, Number(digits))))
          }}
        />
      </div>
    </Modal>
  )
}
