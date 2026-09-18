import type { OrganisationDetailResponse } from '../api/platformApi'

export type TeamAddUserSeatWarning = {
  title: string
  detail: string
  blocksCreate: boolean
}

export function getTeamAddUserSeatWarning(
  billing: OrganisationDetailResponse | null,
  billingLoading: boolean,
): TeamAddUserSeatWarning | null {
  if (billingLoading) return null

  if (!billing?.subscription) {
    return {
      title: 'No licensed seats yet',
      detail:
        'Your organisation needs an active subscription with available seats before you can add users. Set up or extend your plan under Plan & team first.',
      blocksCreate: true,
    }
  }

  const seats = billing.seats
  if (seats.total_entitled_seats <= 0) {
    return {
      title: 'No licensed seats yet',
      detail:
        'You have not purchased or been allocated any seats yet. Request or buy seats under Plan & team, then return here to add users.',
      blocksCreate: true,
    }
  }

  if (seats.available_seats <= 0) {
    return {
      title: 'All seats are in use',
      detail: `Every licensed seat is assigned (${seats.active_assigned_seats} of ${seats.total_entitled_seats}). Request additional seats under Plan & team before adding another user.`,
      blocksCreate: true,
    }
  }

  return null
}
