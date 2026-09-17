import { useCallback, useEffect, useRef, useState } from 'react'
import { tradeApi } from '../api/tradeApi'

const POLL_MS = 15_000
const HEALTH_ATTEMPTS = 3
const RETRY_GAP_MS = 1_200

async function probeHealth(): Promise<boolean> {
  for (let attempt = 0; attempt < HEALTH_ATTEMPTS; attempt += 1) {
    try {
      await tradeApi.health()
      return true
    } catch {
      if (attempt < HEALTH_ATTEMPTS - 1) {
        await new Promise<void>(resolve => window.setTimeout(resolve, RETRY_GAP_MS))
      }
    }
  }
  return false
}

export function useApiHealth(enabled = true) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const timerRef = useRef<number | null>(null)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      const ok = await probeHealth()
      setOnline(ok)
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
