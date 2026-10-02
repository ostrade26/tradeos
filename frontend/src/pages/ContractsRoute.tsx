import { useAuth } from '../hooks/useAuth'
import { isBrokerAccount } from '../lib/auth'
import { BrokerDeskPage } from './BrokerDeskPage'
import { ContractsPage } from './ContractsPage'

export function ContractsRoute() {
  const { session } = useAuth()
  if (isBrokerAccount(session)) return <BrokerDeskPage />
  return <ContractsPage />
}
