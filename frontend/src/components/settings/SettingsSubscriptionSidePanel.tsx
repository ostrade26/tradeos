import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { OrganisationDetailResponse } from '../../api/platformApi'
import { useOrganisationSeatRequestContext } from '../../hooks/useOrganisationSeatRequestContext'
import { useToast } from '../../hooks/useToast'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'
import { SettingsPlanCard } from './SettingsPlanCard'
import { SettingsSeatRequestsCard } from './SettingsSeatRequestsCard'
import { SettingsAddSeatsModal } from './SettingsAddSeatsModal'

export function SettingsSubscriptionPanelContent({
  billing,
  loading,
  canRequestSeats,
  onSeatsChanged,
}: {
  billing: OrganisationDetailResponse | null
  loading: boolean
  canRequestSeats: boolean
  onSeatsChanged: () => void
}) {
  const toast = useToast()
  const seatRequests = useOrganisationSeatRequestContext()
  const [addSeatOpen, setAddSeatOpen] = useState(false)

  const refreshSeatRequests = () => {
    void seatRequests.reload()
  }

  const addonUnitPrice = seatRequests.ctx?.addon_seat_unit_price_cents ?? 0
  const showAddSeatCta =
    canRequestSeats &&
    !seatRequests.loading &&
    Boolean(seatRequests.ctx?.subscription) &&
    addonUnitPrice > 0

  if (loading) {
    return <p className="py-6 text-muted">Loading…</p>
  }
  if (!billing) {
    return (
      <div className="py-8">
        <EmptyState description="No subscription information is available for your organisation yet." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsPlanCard
        detail={billing}
        headerAction={
          showAddSeatCta ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAddSeatOpen(true)}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Add seat
            </Button>
          ) : undefined
        }
      />

      <SettingsSeatRequestsCard
        requests={seatRequests.ctx?.requests ?? []}
        loading={seatRequests.loading}
        canRequest={canRequestSeats}
        onChanged={refreshSeatRequests}
      />

      <SettingsAddSeatsModal
        open={addSeatOpen}
        onClose={() => setAddSeatOpen(false)}
        canRequest={canRequestSeats}
        ctx={seatRequests.ctx}
        loading={seatRequests.loading}
        onSeatsChanged={() => {
          refreshSeatRequests()
          onSeatsChanged()
        }}
        onRequestSuccess={() => {
          toast.success('Seat request sent')
        }}
      />
    </div>
  )
}
