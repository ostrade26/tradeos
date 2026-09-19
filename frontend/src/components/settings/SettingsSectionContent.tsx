import { Link } from 'react-router-dom'
import {
  Moon,
  Sun,
  Download,
  Upload,
  Trash2,
  Database,
  Bell,
  User,
  ChevronRight,
  Palette,
  Rows3,
  PanelLeft,
  KeyRound,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import type { TableDensity } from '../../lib/tableDensity'
import type { SidebarStyle } from '../../lib/sidebarStyle'
import type { SettingsSectionId } from '../../lib/settingsSections'
import { appPath } from '../../lib/appShellMode'
import { SettingsSubscriptionPanelContent } from './SettingsSubscriptionSidePanel'
import { AccentColourPicker } from './AccentColourPicker'
import { BrandingUpsellNote } from './BrandingUpsellNote'
import type { OrganisationDetailResponse } from '../../api/platformApi'
import type { useTheme } from '../../hooks/useTheme'
import type { useTableDensity } from '../../hooks/useTableDensity'

function SettingRow({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Moon
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-200 dark:border-gray-700 last:border-0">
      <div className="flex gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700/50">
          <Icon className="h-4 w-4 text-muted" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-heading">{title}</p>
          <p className="text-xs text-muted mt-0.5">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export type SettingsSectionHandlers = {
  theme: ReturnType<typeof useTheme>
  density: ReturnType<typeof useTableDensity>['density']
  setDensity: ReturnType<typeof useTableDensity>['setDensity']
  canImport: boolean
  canClearTradeData: boolean
  canUseDemoTools: boolean
  canRequestSeats: boolean
  canManageTeam: boolean
  billing: OrganisationDetailResponse | null
  billingLoading: boolean
  onSeatsChanged: () => void
  onMembersChanged: () => void
  onOpenPassword: () => void
  showProductGuideReplay?: boolean
  onReplayProductGuide?: () => void
  replayingProductGuide?: boolean
  showAccountSetupReplay?: boolean
  onReplayAccountSetup?: () => void
  replayingAccountSetup?: boolean
  onExport: (format: 'json' | 'excel' | 'csv') => void
  exporting: 'json' | 'excel' | 'csv' | null
  onImportClick: () => void
  onDownloadTemplate: () => void
  downloadingTemplate: boolean
  onConfirmDemo: () => void
  onConfirmClear: () => void
  importRef: React.RefObject<HTMLInputElement | null>
  onImportFiles: (files: FileList | null) => void
}

export function SettingsSectionContent({
  section,
  h,
}: {
  section: SettingsSectionId
  h: SettingsSectionHandlers
}) {
  const {
    theme,
    setTheme,
    accentId,
    accentPreset,
    accentPresets,
    customHex,
    setAccentId,
    setCustomAccent,
    sidebarStyle,
    setSidebarStyle,
    brandingEnabled,
  } = h.theme

  switch (section) {
    case 'appearance':
      return (
        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Appearance" subtitle="How Tradeal looks on your device" />
          </div>
          <div className="px-6 pb-2">
            <SettingRow
              icon={theme === 'dark' ? Moon : Sun}
              title="Theme"
              description="Light or dark mode"
              action={
                <div className="flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
                  {(['light', 'dark'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded capitalize cursor-pointer transition-colors',
                        theme === t ? 'bg-accent text-white' : 'text-gray-500 hover:text-heading',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              }
            />
            <SettingRow
              icon={Rows3}
              title="Table density"
              description="Compact or relaxed row spacing"
              action={
                <div className="flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
                  {(['compact', 'relaxed'] as const satisfies TableDensity[]).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => h.setDensity(option)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded capitalize cursor-pointer transition-colors',
                        h.density === option ? 'bg-accent text-white' : 'text-gray-500 hover:text-heading',
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              }
            />
            <SettingRow
              icon={PanelLeft}
              title="Side navigation"
              description={
                brandingEnabled
                  ? 'Theme colour or default surface'
                  : 'Unlock Theme colour or Default surface'
              }
              action={
                brandingEnabled ? (
                  <div className="flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
                    {([
                      { id: 'theme' as const, label: 'Theme' },
                      { id: 'default' as const, label: 'Default' },
                    ] satisfies { id: SidebarStyle; label: string }[]).map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSidebarStyle(option.id)}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors',
                          sidebarStyle === option.id ? 'bg-accent text-white' : 'text-gray-500 hover:text-heading',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <BrandingUpsellNote />
                )
              }
            />
            <SettingRow
              icon={Palette}
              title="Primary colour"
              description={
                brandingEnabled
                  ? `Accent · ${accentPreset.label}`
                  : 'Choose accents that match your brand'
              }
              action={
                brandingEnabled ? (
                  <AccentColourPicker
                    accentId={accentId}
                    accentPresets={accentPresets}
                    customHex={customHex}
                    onSelectPreset={setAccentId}
                    onSelectCustom={setCustomAccent}
                  />
                ) : (
                  <BrandingUpsellNote />
                )
              }
            />
          </div>
        </Card>
      )

    case 'account':
      return (
        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Account" subtitle="Profile and sign-in" />
          </div>
          <div className="px-6 pb-2">
            <Link
              to={appPath('/profile')}
              className="flex items-center justify-between gap-4 py-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="flex gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700/50">
                  <User className="h-4 w-4 text-muted" />
                </div>
                <div>
                  <p className="text-sm font-medium text-heading">Edit profile</p>
                  <p className="text-xs text-muted mt-0.5">Name, email, and phone</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted shrink-0" />
            </Link>
            <SettingRow
              icon={Bell}
              title="Trade alerts"
              description="Bell and dashboard inbox — unread until opened"
              action={<span className="text-xs text-muted">Always on</span>}
            />
            <SettingRow
              icon={KeyRound}
              title="Password"
              description="Change your sign-in password"
              action={
                <Button variant="outline" size="sm" onClick={h.onOpenPassword}>
                  Change password
                </Button>
              }
            />
            {h.showAccountSetupReplay ? (
              <SettingRow
                icon={UserRoundCheck}
                title="Account setup"
                description="Replay profile and appearance preferences"
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    loading={h.replayingAccountSetup}
                    disabled={h.replayingAccountSetup}
                    onClick={() => h.onReplayAccountSetup?.()}
                  >
                    Run setup
                  </Button>
                }
              />
            ) : null}
            {h.showProductGuideReplay ? (
              <SettingRow
                icon={Sparkles}
                title="Product guide"
                description="Walk through navigation and key workflows again"
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    loading={h.replayingProductGuide}
                    disabled={h.replayingProductGuide}
                    onClick={() => h.onReplayProductGuide?.()}
                  >
                    Replay tour
                  </Button>
                }
              />
            ) : null}
          </div>
        </Card>
      )

    case 'data':
      return (
        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Data" subtitle="Backup and restore" />
          </div>
          <div className="px-6 pb-4 space-y-2">
            <SettingRow
              icon={Download}
              title="Export backup"
              description="JSON, Excel, or CSV"
              action={
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    loading={h.exporting === 'json'}
                    disabled={!!h.exporting}
                    onClick={() => h.onExport('json')}
                  >
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={h.exporting === 'excel'}
                    disabled={!!h.exporting}
                    onClick={() => h.onExport('excel')}
                  >
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={h.exporting === 'csv'}
                    disabled={!!h.exporting}
                    onClick={() => h.onExport('csv')}
                  >
                    CSV
                  </Button>
                </div>
              }
            />
            {h.canImport && (
              <SettingRow
                icon={Upload}
                title="Import data"
                description="Backup file or PO / SO / Lift spreadsheets"
                action={
                  <>
                    <input
                      ref={h.importRef}
                      type="file"
                      accept=".json,application/json,.csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      multiple
                      className="hidden"
                      onChange={e => h.onImportFiles(e.target.files)}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        loading={h.downloadingTemplate}
                        disabled={h.downloadingTemplate}
                        onClick={() => h.onDownloadTemplate()}
                      >
                        Template
                      </Button>
                      <Button variant="outline" size="sm" onClick={h.onImportClick}>
                        Import
                      </Button>
                    </div>
                  </>
                }
              />
            )}
            {h.canUseDemoTools && (
              <SettingRow
                icon={Database}
                title="Load demo data"
                description="Sample POs, SOs, and lifts (sandbox only)"
                action={
                  <Button variant="outline" size="sm" onClick={h.onConfirmDemo}>
                    Load demo
                  </Button>
                }
              />
            )}
            {h.canClearTradeData && (
              <SettingRow
                icon={Trash2}
                title="Clear all data"
                description="Remove all orders, lifts, inventory, and directory entries"
                action={
                  <Button variant="outlineDanger" size="sm" onClick={h.onConfirmClear}>
                    Clear
                  </Button>
                }
              />
            )}
          </div>
        </Card>
      )

    case 'plan':
      return (
        <SettingsSubscriptionPanelContent
          billing={h.billing}
          loading={h.billingLoading}
          canRequestSeats={h.canRequestSeats}
          onSeatsChanged={h.onSeatsChanged}
        />
      )

    case 'shortcuts':
      return (
        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Keyboard shortcuts" subtitle="From anywhere in the app" />
          </div>
          <div className="px-6 pb-4 divide-y divide-gray-200 dark:divide-gray-700">
            {[
              { keys: '⌘ K', action: 'Open command palette' },
              { keys: '⌘ S', action: 'Save current form (PO, SO, lift)' },
              { keys: 'Esc', action: 'Close drawer or dialog' },
            ].map(item => (
              <div key={item.keys} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-heading">{item.action}</span>
                <kbd className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-mono text-muted dark:border-gray-600 dark:bg-gray-800">
                  {item.keys}
                </kbd>
              </div>
            ))}
          </div>
        </Card>
      )

    default:
      return null
  }
}
