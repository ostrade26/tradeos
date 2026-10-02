import { useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { DatePicker } from '../ui/DatePicker'
import type { BrokerContractShare } from '../../api/organisationApi'
import { organisationApi } from '../../api/organisationApi'
import { ApiError } from '../../api/client'
import { useToast } from '../../hooks/useToast'

export function BrokerRecordLiftModal({
  open,
  share,
  onClose,
  onRecorded,
}: {
  open: boolean
  share: BrokerContractShare
  onClose: () => void
  onRecorded: (share: BrokerContractShare) => void
}) {
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const [partyRole, setPartyRole] = useState<'buyer' | 'seller'>('buyer')
  const [status, setStatus] = useState<'pending' | 'delivered'>('pending')
  const [eventAt, setEventAt] = useState(today)
  const [qtyMt, setQtyMt] = useState('')
  const [tankerNo, setTankerNo] = useState('')
  const [transportName, setTransportName] = useState('')
  const [driverMobile, setDriverMobile] = useState('')
  const [lrNo, setLrNo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setPartyRole('buyer')
    setStatus('pending')
    setEventAt(today)
    setQtyMt('')
    setTankerNo('')
    setTransportName('')
    setDriverMobile('')
    setLrNo('')
    setError('')
  }

  const handleClose = () => {
    if (saving) return
    reset()
    onClose()
  }

  const submit = async () => {
    setError('')
    const qty = parseFloat(qtyMt)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a valid quantity in MT')
      return
    }
    if (!eventAt.trim()) {
      setError('Choose a lift date')
      return
    }
    setSaving(true)
    try {
      const res = await organisationApi.createBrokerRecordedLift(share.id, {
        party_role: partyRole,
        qty_mt: qty,
        status,
        event_at: eventAt,
        tanker_no: tankerNo.trim(),
        transport_name: transportName.trim(),
        driver_mobile: driverMobile.trim(),
        lr_no: lrNo.trim(),
      })
      toast.success('Lift recorded', {
        description: `${qty} MT · ${partyRole === 'buyer' ? share.buyer_name : share.seller_name}`,
      })
      onRecorded(res.share)
      reset()
      onClose()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not record lift'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Record lift"
      subtitle="For movement that is not on a party's Tradeal books yet — e.g. an off-Tradeal counterparty."
      size="md"
      footer={(
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} loading={saving} disabled={saving}>Save lift</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <Select
          label="Recorded for"
          value={partyRole}
          onChange={e => setPartyRole(e.target.value as 'buyer' | 'seller')}
          options={[
            { value: 'buyer', label: `Buyer · ${share.buyer_name || '—'}` },
            { value: 'seller', label: `Seller · ${share.seller_name || '—'}` },
          ]}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DatePicker label="Lift date" value={eventAt} onChange={setEventAt} />
          <Select
            label="Status"
            value={status}
            onChange={e => setStatus(e.target.value as 'pending' | 'delivered')}
            options={[
              { value: 'pending', label: 'In transit' },
              { value: 'delivered', label: 'Delivered' },
            ]}
          />
        </div>
        <Input
          label="Quantity (MT)"
          value={qtyMt}
          onChange={e => setQtyMt(e.target.value)}
          inputMode="decimal"
          protectAutofill={false}
        />
        <Input
          label="Tanker / truck no."
          value={tankerNo}
          onChange={e => setTankerNo(e.target.value)}
        />
        <Input
          label="Transport"
          value={transportName}
          onChange={e => setTransportName(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Driver mobile"
            value={driverMobile}
            onChange={e => setDriverMobile(e.target.value)}
          />
          <Input
            label="LR no."
            value={lrNo}
            onChange={e => setLrNo(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </Modal>
  )
}
