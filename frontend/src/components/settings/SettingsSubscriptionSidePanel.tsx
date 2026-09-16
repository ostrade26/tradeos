import type { OrganisationDetailResponse } from '../../api/platformApi'
import { useOrganisationSeatRequestContext } from '../../hooks/useOrganisationSeatRequestContext'
import { EmptyState } from '../ui/EmptyState'
import { SettingsPlanCard } from './SettingsPlanCard'
import { SettingsSeatRequestsCard } from './SettingsSeatRequestsCard'

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
  const seatRequests = useOrganisationSeatRequestContext()

  const refreshSeatRequests = () => {
    void seatRequests.reload()
  }

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
        canRequestSeats={canRequestSeats}
        seatRequestCtx={seatRequests.ctx}
        seatRequestLoading={seatRequests.loading}
        onSeatsChanged={() => {
          refreshSeatRequests()
          onSeatsChanged()
        }}
      />
      <SettingsSeatRequestsCard
        requests={seatRequests.ctx?.requests ?? []}
        loading={seatRequests.loading}
        canRequest={canRequestSeats}
        onChanged={refreshSeatRequests}
      />
    </div>
  )
}
