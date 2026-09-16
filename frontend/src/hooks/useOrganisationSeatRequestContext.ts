import { useCallback, useEffect, useState } from 'react'
import { organisationApi, type OrganisationSeatRequestContext } from '../api/organisationApi'

export function useOrganisationSeatRequestContext() {
  const [ctx, setCtx] = useState<OrganisationSeatRequestContext | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await organisationApi.seatRequests()
      setCtx(data)
    } catch {
      setCtx(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { ctx, loading, reload }
}
