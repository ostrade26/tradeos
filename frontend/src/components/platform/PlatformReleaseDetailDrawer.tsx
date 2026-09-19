import { useMemo } from 'react'
import {
  ClipboardList,
  FileText,
  GitCommitHorizontal,
  Layers,
  PanelRight,
  PanelRightClose,
  Pencil,
  Rocket,
  Send,
} from 'lucide-react'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { DetailPanelMenu, groupMenuItems } from '../ui/DetailPanelMenu'
import {
  DetailGroup,
  DetailInlineStat,
  DetailInlineStatRow,
  DetailPanelBody,
  DetailRow,
} from '../registers/DetailPanelSections'
import type { PlatformRelease, PlatformReleaseItem } from '../../api/platformApi'
import { releaseCategoryLabel } from '../../lib/releaseVersion'
import { formatDateTime } from '../../lib/utils'
import { platformReleaseIcon as ReleaseIcon } from '../../lib/platformProductIcons'

const actionBtnClass = 'h-auto w-full py-2.5 text-sm'

function sortItems(items: PlatformReleaseItem[]) {
  return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

function itemGroups(items: PlatformReleaseItem[]) {
  const sorted = sortItems(items)
  const byCategory = new Map<string, PlatformReleaseItem[]>()
  for (const item of sorted) {
    const key = item.category || 'other'
    const list = byCategory.get(key) ?? []
    list.push(item)
    byCategory.set(key, list)
  }
  return [...byCategory.entries()]
}

export function PlatformReleaseDetailDrawer({
  release,
  open,
  onClose,
  docked = false,
  onDockChange,
  onEdit,
  onPublish,
  isLatest = false,
}: {
  release: PlatformRelease | null
  open: boolean
  onClose: () => void
  docked?: boolean
  onDockChange?: (docked: boolean) => void
  onEdit: () => void
  onPublish: () => void
  isLatest?: boolean
}) {
  const isDraft = release?.status === 'draft'
  const isPublished = release?.status === 'published'
  const groups = useMemo(
    () => (release ? itemGroups(release.items ?? []) : []),
    [release],
  )

  const panelMenuItems = useMemo(() => {
    if (!release || !isDraft) return []
    return groupMenuItems([
      {
        items: [
          { type: 'button', label: 'Edit draft', icon: Pencil, onClick: onEdit },
          { type: 'button', label: 'Publish', icon: Send, onClick: onPublish },
        ],
      },
    ])
  }, [release, isDraft, onEdit, onPublish])

  if (!release) return null

  const headerBadges = (
    <>
      <Badge variant={isPublished ? 'success' : 'info'} className="shrink-0">
        {isPublished ? 'Published' : 'Draft'}
      </Badge>
      {release.source === 'deploy' ? (
        <Badge variant="default" className="shrink-0">
          Deploy
        </Badge>
      ) : null}
      {isLatest ? (
        <Badge variant="accent" className="shrink-0">
          {isPublished ? 'Last update' : 'Latest'}
        </Badge>
      ) : null}
    </>
  )

  const dockToggle = onDockChange ? (
    <button
      type="button"
      onClick={() => onDockChange(!docked)}
      className="hidden lg:inline-flex rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-zinc-800 cursor-pointer attex-focus"
      aria-label={docked ? 'Undock panel' : 'Dock panel to the right'}
      title={docked ? 'Undock panel' : 'Dock to right'}
    >
      {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
    </button>
  ) : null

  const headerActions = (
    <>
      {dockToggle}
      {panelMenuItems.length > 0 ? (
        <DetailPanelMenu onItemSelect={onClose} items={panelMenuItems} />
      ) : null}
    </>
  )

  const footer = isDraft ? (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" className={actionBtnClass} onClick={onEdit}>
        <Pencil className="h-4 w-4" aria-hidden />
        Edit draft
      </Button>
      <Button size="sm" className={actionBtnClass} onClick={onPublish}>
        <Send className="h-4 w-4" aria-hidden />
        Publish
      </Button>
    </div>
  ) : undefined

  const content = (
    <DetailPanelBody>
      <DetailGroup title="Overview" icon={ClipboardList}>
        <div className="space-y-2.5">
          <DetailRow label="Version" value={release.version} mono />
          <DetailRow
            label="Delivery"
            value={release.gated ? 'Features → catalog' : 'Notify only'}
          />
          <DetailRow
            label="Source"
            value={release.source === 'deploy' ? 'Production deploy' : 'Manual'}
          />
          <DetailRow label="Created" value={formatDateTime(release.created_at)} />
          <DetailRow
            label="Published"
            value={release.published_at ? formatDateTime(release.published_at) : '—'}
          />
          {release.updated_at && release.updated_at !== release.created_at ? (
            <DetailRow label="Updated" value={formatDateTime(release.updated_at)} />
          ) : null}
        </div>
      </DetailGroup>

      {(release.deploy_commit_sha || release.deploy_environment) && (
        <DetailGroup title="Deploy" icon={GitCommitHorizontal} surface="muted">
          <div className="space-y-2.5">
            {release.deploy_commit_sha ? (
              <DetailRow label="Commit" value={release.deploy_commit_sha.slice(0, 12)} mono />
            ) : null}
            {release.deploy_environment ? (
              <DetailRow label="Environment" value={release.deploy_environment} />
            ) : null}
          </div>
        </DetailGroup>
      )}

      {release.summary?.trim() ? (
        <DetailGroup title="Summary" icon={FileText} surface="muted">
          <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">
            {release.summary.trim()}
          </p>
        </DetailGroup>
      ) : null}

      <DetailGroup
        title={groups.length === 1 ? releaseCategoryLabel(groups[0]![0]) : 'Changes'}
        icon={Layers}
        trailing={
          <span className="text-xs text-muted tabular-nums">
            {release.items.length} item{release.items.length === 1 ? '' : 's'}
          </span>
        }
      >
        {release.items.length === 0 ? (
          <p className="text-sm text-muted">No change items yet.</p>
        ) : (
          <div className="space-y-5">
            {groups.map(([category, items]) => (
              <div key={category}>
                {groups.length > 1 ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted mb-2.5">
                    {releaseCategoryLabel(category)}
                  </p>
                ) : null}
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((item, index) => (
                    <div
                      key={item.id ?? `${category}-${index}`}
                      className="py-3 first:pt-0 last:pb-0"
                    >
                      <p className="text-sm font-semibold text-heading leading-snug">{item.title}</p>
                      {item.detail?.trim() ? (
                        <p className="text-sm text-muted mt-1.5 leading-relaxed whitespace-pre-wrap">
                          {item.detail.trim()}
                        </p>
                      ) : null}
                      {item.feature_key?.trim() ? (
                        <p className="text-xs font-mono text-muted mt-2 truncate">
                          {item.feature_key.trim()}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailGroup>

      {isPublished && (release.sent != null || release.skipped_expired_amc != null) ? (
        <DetailGroup title="Notify results" icon={Rocket} surface="muted">
          <DetailInlineStatRow>
            <DetailInlineStat label="Sent" value={String(release.sent ?? 0)} />
            <DetailInlineStat
              label="Skipped (AMC)"
              value={String(release.skipped_expired_amc ?? 0)}
            />
          </DetailInlineStatRow>
        </DetailGroup>
      ) : null}
    </DetailPanelBody>
  )

  const panelProps = {
    title: release.title,
    subtitle: release.version,
    headerBadges,
    headerIcon: ReleaseIcon,
    footer,
    onClose,
    headerActions,
    width: 'lg' as const,
  }

  if (docked) {
    if (!open) return null
    return <DockedPanel {...panelProps}>{content}</DockedPanel>
  }

  return (
    <Drawer open={open} {...panelProps}>
      {content}
    </Drawer>
  )
}
