import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, Download, Upload, Trash2, Database, Bell, User, ChevronRight, Palette, Rows3 } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { usePermissions } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useTableDensity } from '../hooks/useTableDensity'
import type { TableDensity } from '../lib/tableDensity'
import { useToast } from '../hooks/useToast'
import { useTradeStore } from '../store/TradeStore'
import { describeTradeBackup, describeImportResult, exportAllTradeData, exportImportTemplate, readBackupFile, readMultipleSpreadsheetFiles, type TradeBackup } from '../lib/dataExport'
import { cn } from '../lib/utils'
import { CUSTOM_ACCENT_ID } from '../lib/accentColor'

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

export function SettingsPage() {
  const { isAdmin } = usePermissions()
  const { theme, setTheme, accentId, accentPreset, accentPresets, customHex, setAccentId, setCustomAccent } = useTheme()
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

  const handleExport = async (format: 'json' | 'excel' | 'csv') => {
    if (exporting) return
    setExporting(format)
    try {
      await exportAllTradeData(store, format)
      if (format === 'excel' && store.tradeOrders.length === 0) {
        toast.info('Excel exported', { description: 'No trade data in the app — sheets will show “No records”.' })
      } else {
        toast.success(`${format.toUpperCase()} backup exported`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  const handleImport = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const files = Array.from(fileList)
    try {
      const backup = files.length === 1
        ? await readBackupFile(files[0]!)
        : await readMultipleSpreadsheetFiles(files)
      if (backup.data.tradeOrders.length === 0 && backup.data.lifts.length === 0) {
        toast.error('No trade data recognized', {
          description: 'Use the import template or a TradeOS backup. You can pick one file or separate PO, SO, and Lift spreadsheets.',
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

  const handleDownloadTemplate = async () => {
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
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Appearance, data, and account preferences"
        breadcrumb={<Breadcrumb items={[{ label: 'TradeOS', href: '/' }, { label: 'Settings' }]} />}
      />

      <div className="space-y-6">
        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Appearance" subtitle="How TradeOS looks on your device" />
          </div>
          <div className="px-6 pb-2">
            <SettingRow
              icon={theme === 'dark' ? Moon : Sun}
              title="Theme"
              description="Switch between light and dark mode"
              action={
                <div className="flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
                  {(['light', 'dark'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded capitalize cursor-pointer transition-colors',
                        theme === t
                          ? 'bg-accent text-white'
                          : 'text-gray-500 hover:text-heading',
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
              description="Compact fits more rows on screen; relaxed adds extra cell padding for easier scanning"
              action={
                <div className="flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
                  {(['compact', 'relaxed'] as const satisfies TableDensity[]).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDensity(option)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded capitalize cursor-pointer transition-colors',
                        density === option
                          ? 'bg-accent text-white'
                          : 'text-gray-500 hover:text-heading',
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
              description={`Accent for buttons, links, and highlights · ${accentPreset.label}`}
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
                          'h-8 w-8 rounded-full cursor-pointer transition-all attex-focus border-2 bg-white dark:bg-card',
                          selected
                            ? 'ring-2 ring-offset-2 ring-heading dark:ring-offset-[var(--color-card)] border-transparent'
                            : 'hover:scale-105',
                        )}
                        style={{
                          backgroundColor: selected ? preset.accent : undefined,
                          borderColor: preset.accent,
                        }}
                      />
                    )
                  })}
                  <label
                    title="Custom colour"
                    className={cn(
                      'relative h-8 w-8 rounded-full cursor-pointer overflow-hidden attex-focus border-2 bg-white dark:bg-card',
                      accentId === CUSTOM_ACCENT_ID
                        ? 'ring-2 ring-offset-2 ring-heading dark:ring-offset-[var(--color-card)] border-transparent'
                        : 'border-gray-300 dark:border-gray-600 hover:scale-105',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute rounded-full',
                        accentId === CUSTOM_ACCENT_ID ? 'inset-0' : 'inset-1',
                      )}
                      style={{
                        background: accentId === CUSTOM_ACCENT_ID
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

        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Account" subtitle="Profile and notification preferences" />
          </div>
          <div className="px-6 pb-2">
            <Link
              to="/profile"
              className="flex items-center justify-between gap-4 py-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="flex gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700/50">
                  <User className="h-4 w-4 text-muted" />
                </div>
                <div>
                  <p className="text-sm font-medium text-heading">Edit profile</p>
                  <p className="text-xs text-muted mt-0.5">Name, location, email, and phone</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted shrink-0" />
            </Link>
            <SettingRow
              icon={Bell}
              title="Trade alerts"
              description="Ready-to-lift qty, low stock, and in-transit lifts appear in the bell. Same list as Action inbox on the dashboard — unread until you open an item."
              action={<span className="text-xs text-muted">Always on</span>}
            />
          </div>
        </Card>

        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Data" subtitle="Export, import, demo, and reset options" />
          </div>
          <div className="px-6 pb-4 space-y-2">
            <SettingRow
              icon={Download}
              title="Export backup"
              description="Download all trade data as JSON, Excel, or CSV"
              action={
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" loading={exporting === 'json'} disabled={!!exporting} onClick={() => void handleExport('json')}>
                    JSON
                  </Button>
                  <Button variant="outline" size="sm" loading={exporting === 'excel'} disabled={!!exporting} onClick={() => void handleExport('excel')}>
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" loading={exporting === 'csv'} disabled={!!exporting} onClick={() => void handleExport('csv')}>
                    CSV
                  </Button>
                </div>
              }
            />
            {isAdmin && (
              <SettingRow
                icon={Upload}
                title="Import data"
                description="JSON backup, import template with sample demo rows, or Excel/CSV — one file or separate PO, SO, and Lift sheets"
                action={
                  <>
                    <input
                      ref={importRef}
                      type="file"
                      accept=".json,application/json,.csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      multiple
                      className="hidden"
                      onChange={e => void handleImport(e.target.files)}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        loading={downloadingTemplate}
                        disabled={downloadingTemplate}
                        onClick={() => void handleDownloadTemplate()}
                      >
                        Template
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => importRef.current?.click()}
                      >
                        Import
                      </Button>
                    </div>
                  </>
                }
              />
            )}
            {isAdmin && (
              <SettingRow
                icon={Database}
                title="Load demo data"
                description="Replace current data with sample POs, SOs, and lifts"
                action={
                  <Button variant="outline" size="sm" onClick={() => setConfirmDemo(true)}>
                    Load demo
                  </Button>
                }
              />
            )}
            {isAdmin && (
              <SettingRow
                icon={Trash2}
                title="Clear all data"
                description="Remove all orders, lifts, inventory, and directory entries"
                action={
                  <Button
                    variant="outlineDanger"
                    size="sm"
                    onClick={() => setConfirmClear(true)}
                  >
                    Clear
                  </Button>
                }
              />
            )}
          </div>
        </Card>

        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Keyboard shortcuts" subtitle="Quick actions from anywhere in the app" />
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
      </div>

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
          <p className="text-sm font-medium text-heading mt-2">
            {describeTradeBackup(pendingImport.data)}
          </p>
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
      >
        <p className="text-sm text-gray-600 dark:text-muted">
          This removes all orders, lifts, inventory, and directory entries. This cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  )
}
