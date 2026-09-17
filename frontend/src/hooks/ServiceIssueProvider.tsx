import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ServiceIssueModal } from '../components/feedback/ServiceIssueModal'
import { ServiceIssueFullPage } from '../components/feedback/ServiceIssueFullPage'
import {
  SERVICE_ISSUE_EVENT,
  type ServiceIssueView,
  classifyUnknownError,
} from '../lib/serviceIssue'
import { serviceIssueUsesFullPage } from '../lib/serviceIssueTheme'

type ServiceIssueContextValue = {
  reportIssue: (err: unknown) => void
  showIssue: (issue: ServiceIssueView) => void
  clearIssue: () => void
}

const ServiceIssueContext = createContext<ServiceIssueContextValue | null>(null)

export function ServiceIssueProvider({ children }: { children: ReactNode }) {
  const [issue, setIssue] = useState<ServiceIssueView | null>(null)
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)

  const showIssue = useCallback((next: ServiceIssueView) => {
    setIssue(next)
    setOpen(true)
  }, [])

  const reportIssue = useCallback(
    (err: unknown) => {
      showIssue(classifyUnknownError(err))
    },
    [showIssue],
  )

  const clearIssue = useCallback(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<ServiceIssueView>).detail
      if (detail?.title) showIssue(detail)
    }
    window.addEventListener(SERVICE_ISSUE_EVENT, onEvent)
    return () => window.removeEventListener(SERVICE_ISSUE_EVENT, onEvent)
  }, [showIssue])

  const onRefresh = useCallback(() => {
    setChecking(true)
    window.location.reload()
  }, [])

  const value = useMemo(
    () => ({ reportIssue, showIssue, clearIssue }),
    [reportIssue, showIssue, clearIssue],
  )

  const fullPage = Boolean(open && issue && serviceIssueUsesFullPage(issue.kind))

  return (
    <ServiceIssueContext.Provider value={value}>
      {fullPage && issue ? (
        <ServiceIssueFullPage
          issue={issue}
          checking={checking}
          onRefresh={onRefresh}
          onBeforeHome={clearIssue}
        />
      ) : (
        <>
          {children}
          <ServiceIssueModal
            open={open}
            issue={issue}
            checking={checking}
            onRefresh={onRefresh}
            onClose={clearIssue}
          />
        </>
      )}
    </ServiceIssueContext.Provider>
  )
}

export function useServiceIssue() {
  const ctx = useContext(ServiceIssueContext)
  if (!ctx) throw new Error('useServiceIssue must be used within ServiceIssueProvider')
  return ctx
}
