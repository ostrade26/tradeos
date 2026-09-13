import { useCallback, useEffect, useRef, useState } from 'react'
import { tradeApi } from '../api/tradeApi'

const POLL_MS = 15_000

export function useApiHealth(enabled = true) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const timerRef = useRef<number | null>(null)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      await tradeApi.health()
      setOnline(true)
    } catch {
      setOnline(false)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    void check()
    timerRef.current = window.setInterval(() => void check(), POLL_MS)
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
  }, [check, enabled])

  return { online, checking, retry: check }
}
