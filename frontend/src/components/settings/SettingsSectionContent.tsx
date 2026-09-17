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
  KeyRound,
} from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { CUSTOM_ACCENT_ID } from '../../lib/accentColor'
import type { TableDensity } from '../../lib/tableDensity'
import type { SettingsSectionId } from '../../lib/settingsSections'
import { appPath } from '../../lib/appShellMode'
import { SettingsSubscriptionPanelContent } from './SettingsSubscriptionSidePanel'
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
  canUseDemoTools: boolean
  canRequestSeats: boolean
  canManageTeam: boolean
  billing: OrganisationDetailResponse | null
  billingLoading: boolean
  onSeatsChanged: () => void
  onMembersChanged: () => void
  onOpenPassword: () => void
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
              icon={Palette}
              title="Primary colour"
              description={`Accent · ${accentPreset.label}`}
              action={
                <div className="flex flex-wrap justify-end gap-2.5 max-w-[14rem]">
                  {accentPresets.map(preset => {
                    const selected = accentId === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.label}
                        aria-label={preset.label}
                        aria-pressed={selected}
                        onClick={() => setAccentId(preset.id)}
                        className={cn(
                          'h-8 w-8 rounded-full cursor-pointer transition-all attex-focus border-2 border-transparent',
                          selected
                            ? 'ring-2 ring-offset-2 ring-heading dark:ring-offset-[var(--color-card)] scale-105'
                            : 'hover:scale-105 opacity-90 hover:opacity-100',
                        )}
                        style={{ backgroundColor: preset.accent }}
                      />
                    )
                  })}
                  <label
                    title="Custom colour"
                    className={cn(
                      'relative h-8 w-8 rounded-full cursor-pointer overflow-hidden attex-focus border-2 border-transparent',
                      accentId === CUSTOM_ACCENT_ID
                        ? 'ring-2 ring-offset-2 ring-heading dark:ring-offset-[var(--color-card)] scale-105'
                        : 'opacity-90 hover:opacity-100 hover:scale-105',
                    )}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          accentId === CUSTOM_ACCENT_ID
                            ? customHex
                            : 'conic-gradient(from 180deg, #ff3b30, #ff9500, #34c759, #007aff, #af52de, #ff2d55, #ff3b30)',
                      }}
                    />
                    <input
                      type="color"
                      value={customHex}
                      aria-label="Pick a custom primary colour"
                      onChange={e => setCustomAccent(e.target.value)}
                      onClick={() => {
                        if (accentId !== CUSTOM_ACCENT_ID) setCustomAccent(customHex)
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
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
                description="Sample POs, SOs, and lifts (test org only)"
                action={
                  <Button variant="outline" size="sm" onClick={h.onConfirmDemo}>
                    Load demo
                  </Button>
                }
              />
            )}
            {h.canUseDemoTools && (
              <SettingRow
                icon={Trash2}
                title="Clear all data"
                description="Remove all trade data (test org only)"
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
