import { useMemo, useState } from 'react'
import { DataTable } from '../ui/DataTable'
import { Badge } from '../ui/Badge'
import { Drawer } from '../ui/Drawer'
import { notificationKindLabel } from '../../lib/notificationDisplay'
import { formatDateTime } from '../../lib/utils'
import type { UnifiedInboxItem } from '../../lib/unifiedInbox'

function sentTypeLabel(item: UnifiedInboxItem): string {
  if (item.category === 'sent' && item.productRequest && !item.send) {
    return 'Sent to Tradeal'
  }
  return notificationKindLabel(item.kind)
}

function sourceLabel(source: string | undefined): string {
  if (source === 'schedule') return 'Scheduled'
  if (source === 'release') return 'Release'
  if (source === 'credentials') return 'Credentials'
  if (source === 'manual') return 'Manual'
  return source ? source.replace(/_/g, ' ') : '—'
}

const columns = [
  {
    key: 'kind',
    header: 'Type',
    sortable: true,
    sortValue: (row: UnifiedInboxItem) => sentTypeLabel(row),
    render: (row: UnifiedInboxItem) => (
      <span className="text-sm text-heading whitespace-nowrap">{sentTypeLabel(row)}</span>
    ),
  },
  {
    key: 'title',
    header: 'Title',
    sortable: true,
    sortValue: (row: UnifiedInboxItem) => row.title,
    render: (row: UnifiedInboxItem) => (
      <div className="min-w-0 max-w-[18rem]">
        <p className="font-medium text-heading truncate">{row.title || '—'}</p>
        {row.send?.source ? (
          <p className="text-xs text-muted mt-0.5">{sourceLabel(row.send.source)}</p>
        ) : null}
      </div>
    ),
  },
  {
    key: 'audience',
    header: 'Audience',
    sortable: true,
    sortValue: (row: UnifiedInboxItem) => row.subtitle,
    render: (row: UnifiedInboxItem) => (
      <span className="text-sm text-muted">{row.subtitle || '—'}</span>
    ),
  },
  {
    key: 'sent_count',
    header: 'Sent to',
    sortable: true,
    sortValue: (row: UnifiedInboxItem) => row.send?.sent_count ?? 0,
    render: (row: UnifiedInboxItem) => {
      const n = row.send?.sent_count
      if (n == null) return <span className="text-sm text-muted">—</span>
      return (
        <span className="text-sm tabular-nums text-heading">
          {n} {n === 1 ? 'person' : 'people'}
        </span>
      )
    },
  },
  {
    key: 'when',
    header: 'When',
    sortable: true,
    sortValue: (row: UnifiedInboxItem) => row.dateIso || '',
    render: (row: UnifiedInboxItem) => (
      <span className="text-sm text-muted whitespace-nowrap">
        {row.dateIso ? formatDateTime(row.dateIso) : '—'}
      </span>
    ),
  },
]

export function InboxSentTable({
  rows,
  emptyDescription,
}: {
  rows: UnifiedInboxItem[]
  emptyDescription: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(
    () => rows.find(r => r.id === selectedId) ?? null,
    [rows, selectedId],
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={row => row.id}
        activeRowId={selectedId ?? undefined}
        onRowClick={row => setSelectedId(row.id)}
        fullWidth
        emptyMessage="Nothing sent"
        emptyState={
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-heading">Nothing sent</p>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">{emptyDescription}</p>
          </div>
        }
      />
      <Drawer
        open={selected != null}
        onClose={() => setSelectedId(null)}
        title={selected?.title || 'Sent item'}
        subtitle={selected ? sentTypeLabel(selected) : undefined}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">{sentTypeLabel(selected)}</Badge>
              {selected.send?.source ? (
                <Badge variant="info">{sourceLabel(selected.send.source)}</Badge>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Audience</p>
              <p className="text-sm text-heading mt-1">{selected.subtitle}</p>
            </div>
            {selected.send ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Recipients</p>
                  <p className="text-sm tabular-nums text-heading mt-1">{selected.send.sent_count}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">When</p>
                  <p className="text-sm text-heading mt-1">
                    {selected.dateIso ? formatDateTime(selected.dateIso) : '—'}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">When</p>
                <p className="text-sm text-heading mt-1">
                  {selected.dateIso ? formatDateTime(selected.dateIso) : '—'}
                </p>
              </div>
            )}
            {(selected.send?.body || selected.productRequest?.message) && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Message</p>
                <p className="text-sm text-heading mt-1 whitespace-pre-wrap leading-relaxed">
                  {selected.send?.body || selected.productRequest?.message}
                </p>
              </div>
            )}
            {selected.from ? (
              <p className="text-xs text-muted">From {selected.from}</p>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  )
}
