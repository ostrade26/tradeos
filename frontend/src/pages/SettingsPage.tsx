import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useAuth, usePermissions } from '../hooks/useAuth'
import { useProductTour } from '../contexts/ProductTourContext'
import { ApiError } from '../api/client'
import { useTheme } from '../hooks/useTheme'
import { useTableDensity } from '../hooks/useTableDensity'
import { useToast } from '../hooks/useToast'
import { useTradeStore } from '../store/TradeStore'
import {
  describeTradeBackup,
  describeImportResult,
  exportAllTradeData,
  exportImportTemplate,
  readBackupFile,
  readMultipleSpreadsheetFiles,
  type TradeBackup,
} from '../lib/dataExport'
import { cn } from '../lib/utils'
import { ChangePasswordModal } from '../components/settings/ChangePasswordForm'
import { organisationApi } from '../api/organisationApi'
import type { OrganisationDetailResponse } from '../api/platformApi'
import {
  SETTINGS_SECTIONS,
  isSettingsSectionId,
  settingsPath,
  type SettingsSectionId,
} from '../lib/settingsSections'
import { APP_HOME, appPath } from '../lib/appShellMode'
import {
  SettingsSectionContent,
  type SettingsSectionHandlers,
} from '../components/settings/SettingsSectionContent'
import { SettingsTeamSection } from '../components/settings/SettingsTeamPanel'

function useSettingsBilling(canViewSubscription: boolean) {
  const [billing, setBilling] = useState<OrganisationDetailResponse | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)

  const reloadBilling = useCallback(() => {
    if (!canViewSubscription) return
    setBillingLoading(true)
    organisationApi
      .billing()
      .then(setBilling)
      .catch(() => setBilling(null))
      .finally(() => setBillingLoading(false))
  }, [canViewSubscription])

  useEffect(() => {
    reloadBilling()
  }, [reloadBilling])

  return { billing, billingLoading, reloadBilling }
}

/** Shared state + dialogs for all settings routes */
export function SettingsLayout() {
  const { isPlatformAdmin } = useAuth()
  const { hasPermission, organisationSandboxTools } = usePermissions()
  const productTour = useProductTour()
  const canImport = hasPermission('organisation.edit')
  const canUseDemoTools = organisationSandboxTools && hasPermission('organisation.edit')
  const canViewSubscription = hasPermission('organisation.subscription.view')
  const canRequestSeats = hasPermission('organisation.seats.request')
  const canManageTeam = hasPermission('organisation.edit')
  const showPlanSection = (canViewSubscription || canRequestSeats) && canManageTeam
  const showTeamSection = canManageTeam

  const themeApi = useTheme()
  const { density, setDensity } = useTableDensity()
  const store = useTradeStore()
  const toast = useToast()
  const importRef = useRef<HTMLInputElement>(null)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [pendingImport, setPendingImport] = useState<TradeBackup | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState<'json' | 'excel' | 'csv' | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [replayingProductGuide, setReplayingProductGuide] = useState(false)

  const handleReplayProductGuide = useCallback(async () => {
    if (!productTour || replayingProductGuide) return
    setReplayingProductGuide(true)
    try {
      await productTour.replayProductTour()
      toast.success('Product guide started')
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not start product guide',
      )
    } finally {
      setReplayingProductGuide(false)
    }
  }, [productTour, replayingProductGuide, toast])

  const { billing, billingLoading, reloadBilling } = useSettingsBilling(showPlanSection || showTeamSection)

  const handleExport = async (format: 'json' | 'excel' | 'csv') => {
    if (exporting) return
    setExporting(format)
    try {
      await exportAllTradeData(store, format)
      if (format === 'excel' && store.tradeOrders.length === 0) {
        toast.info('Excel exported', { description: 'No trade data — sheets show “No records”.' })
      } else {
        toast.success(`${format.toUpperCase()} backup exported`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  const handleDownloadTemplate = useCallback(async () => {
    if (downloadingTemplate) return
    setDownloadingTemplate(true)
    try {
      await exportImportTemplate()
      toast.success('Import template downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download template')
    } finally {
      setDownloadingTemplate(false)
    }
  }, [downloadingTemplate, toast])

  const handleImport = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const files = Array.from(fileList)
    try {
      const backup =
        files.length === 1 ? await readBackupFile(files[0]!) : await readMultipleSpreadsheetFiles(files)
      if (backup.data.tradeOrders.length === 0 && backup.data.lifts.length === 0) {
        toast.error('No trade data recognized', {
          description: 'Use the template or a Tradeal backup.',
        })
        return
      }
      setPendingImport(backup)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read import file')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  const sectionHandlers: SettingsSectionHandlers = useMemo(
    () => ({
      theme: themeApi,
      density,
      setDensity,
      canImport,
      canUseDemoTools,
      canRequestSeats,
      canManageTeam,
      billing,
      billingLoading,
      onSeatsChanged: reloadBilling,
      onMembersChanged: reloadBilling,
      onOpenPassword: () => setPasswordModalOpen(true),
      showProductGuideReplay: !isPlatformAdmin && !!productTour,
      onReplayProductGuide: () => void handleReplayProductGuide(),
      replayingProductGuide,
      onExport: format => void handleExport(format),
      exporting,
      onImportClick: () => importRef.current?.click(),
      onDownloadTemplate: () => void handleDownloadTemplate(),
      downloadingTemplate,
      onConfirmDemo: () => setConfirmDemo(true),
      onConfirmClear: () => setConfirmClear(true),
      importRef,
      onImportFiles: files => void handleImport(files),
    }),
    [
      themeApi,
      density,
      setDensity,
      canImport,
      canUseDemoTools,
      canRequestSeats,
      canManageTeam,
      billing,
      billingLoading,
      reloadBilling,
      exporting,
      downloadingTemplate,
      handleDownloadTemplate,
      handleReplayProductGuide,
      isPlatformAdmin,
      productTour,
      replayingProductGuide,
    ],
  )

  return (
    <>
      <Outlet context={{ sectionHandlers, showPlanSection, showTeamSection }} />
      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
      <ConfirmDialog
        open={pendingImport != null}
        onClose={() => !importing && setPendingImport(null)}
        onConfirm={async () => {
          if (!pendingImport) return
          setImporting(true)
          try {
            const importedState = await store.importAll({
              version: pendingImport.version,
              data: pendingImport.data,
            })
            const imported = describeImportResult(importedState)
            toast.success('Data imported', {
              description: imported.hint ? `${imported.summary}. ${imported.hint}` : imported.summary,
            })
            setPendingImport(null)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not import data')
            throw err
          } finally {
            setImporting(false)
          }
        }}
        title="Import data?"
        confirmLabel="Import"
        confirmLoading={importing}
      >
        <p className="text-sm text-gray-600 dark:text-muted">
          This replaces all current trade data with the imported file
          {pendingImport?.exportedAt
            ? ` exported on ${new Date(pendingImport.exportedAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : ''}.
        </p>
        {pendingImport && (
          <p className="text-sm font-medium text-heading mt-2">{describeTradeBackup(pendingImport.data)}</p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmDemo}
        onClose={() => setConfirmDemo(false)}
        onConfirm={async () => {
          try {
            await store.loadDemo()
            toast.success('Demo data loaded')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not load demo data')
            throw err
          }
        }}
        title="Load demo data?"
        confirmLabel="Load demo"
      >
        <p className="text-sm text-gray-600 dark:text-muted">
          This replaces all current trade data with sample POs, SOs, lifts, and directory entries.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={async () => {
          try {
            await store.resetAll()
            toast.success('All data cleared')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not clear data')
            throw err
          }
        }}
        title="Clear all data?"
        confirmLabel="Clear everything"
        variant="danger"
        slideLabel="Slide to clear"
      >
        <p className="text-sm text-gray-600 dark:text-muted">
          This removes all orders, lifts, inventory, and directory entries. This cannot be undone.
        </p>
      </ConfirmDialog>
    </>
  )
}

type SettingsOutletContext = {
  sectionHandlers: SettingsSectionHandlers
  showPlanSection: boolean
  showTeamSection: boolean
}

function useSettingsOutlet(): SettingsOutletContext {
  return useOutletContext<SettingsOutletContext>()
}

function visibleSections(showPlanSection: boolean, showTeamSection: boolean) {
  return SETTINGS_SECTIONS.filter(s => {
    if (s.planSection && !showPlanSection) return false
    if (s.teamSection && !showTeamSection) return false
    return true
  })
}

export function SettingsHubPage() {
  const { showPlanSection, showTeamSection } = useSettingsOutlet()
  const sections = visibleSections(showPlanSection, showTeamSection)

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Choose a category"
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: APP_HOME }, { label: 'Settings' }]} />}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map(section => {
          const Icon = section.icon
          return (
            <Link key={section.id} to={settingsPath(section.segment)} className="group block">
              <Card hover className="h-full flex items-start gap-3 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700/50">
                  <Icon className="h-5 w-5 text-muted group-hover:text-accent transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-heading">{section.label}</p>
                  <p className="text-xs text-muted mt-0.5">{section.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function SettingsSectionPage() {
  const { section: sectionParam } = useParams<{ section: string }>()
  const { sectionHandlers, showPlanSection, showTeamSection } = useSettingsOutlet()

  if (!sectionParam || !isSettingsSectionId(sectionParam)) {
    return <Navigate to={appPath('/settings')} replace />
  }

  const section = sectionParam as SettingsSectionId
  if (section === 'plan' && !showPlanSection) {
    return <Navigate to={appPath('/settings')} replace />
  }
  if (section === 'team' && !showTeamSection) {
    return <Navigate to={appPath('/settings')} replace />
  }

  const meta = SETTINGS_SECTIONS.find(s => s.id === section)
  const sectionMaxWidth =
    section === 'team' ? 'w-full max-w-none' : section === 'plan' ? 'max-w-3xl' : 'max-w-2xl'

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: 'Tradeal', href: APP_HOME },
        { label: 'Settings', href: appPath('/settings') },
        { label: meta?.label ?? section },
      ]}
    />
  )

  if (section === 'team') {
    return (
      <div className={cn('animate-fade-in', sectionMaxWidth)}>
        <SettingsTeamSection
          title={meta?.label ?? 'Team'}
          subtitle={meta?.description}
          breadcrumb={breadcrumb}
          canManage={sectionHandlers.canManageTeam}
          billing={sectionHandlers.billing}
          billingLoading={sectionHandlers.billingLoading}
          canRequestSeats={sectionHandlers.canRequestSeats}
          onMembersChanged={sectionHandlers.onMembersChanged}
        />
      </div>
    )
  }

  return (
    <div className={cn('animate-fade-in', sectionMaxWidth)}>
      <PageHeader
        title={meta?.label ?? 'Settings'}
        subtitle={section === 'plan' ? undefined : meta?.description}
        breadcrumb={breadcrumb}
      />
      <SettingsSectionContent section={section} h={sectionHandlers} />
    </div>
  )
}
