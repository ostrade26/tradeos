import { useAuth } from '../hooks/useAuth'
import { getAccountTraderName, getAccountTraderLocation } from './accountBuyer'

/** Signed-in organisation as the account buyer/seller on orders. */
export function useAccountTrader() {
  const { session } = useAuth()
  const name = getAccountTraderName(session?.organisationName)
  const location = getAccountTraderLocation(session?.location)
  return { name, location, organisationName: session?.organisationName ?? null }
}
