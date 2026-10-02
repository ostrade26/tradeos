import { useAuth } from '../hooks/useAuth'
import { isBrokerAccount } from '../lib/auth'
import { BrokerLiftRegisterPage } from './BrokerLiftRegisterPage'
import { LiftRegisterPage } from './LiftRegisterPage'

export function LiftsRoute() {
  const { session } = useAuth()
  if (isBrokerAccount(session)) return <BrokerLiftRegisterPage />
  return <LiftRegisterPage />
}
