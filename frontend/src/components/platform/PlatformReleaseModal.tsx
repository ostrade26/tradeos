import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import {
  RELEASE_CATEGORIES,
  isGatedReleaseCategory,
  releaseCategorySelectOptions,
  suggestNextVersion,
  type ReleaseCategory,
} from '../../lib/releaseVersion'
import type { PlatformRelease, PlatformReleaseItem } from '../../api/platformApi'

export type ReleaseFormPayload = {
  version: string
  title: string
  summary: string
  items: Array<Pick<PlatformReleaseItem, 'category' | 'title' | 'detail' | 'feature_key'>>
}

function emptyItem(): ReleaseFormPayload['items'][number] {
  return { category: 'bug_fix', title: '', detail: '', feature_key: '' }
}

function formFromRelease(release: PlatformRelease | null, nextVersion: string): ReleaseFormPayload {
  if (!release) {
    return {
      version: nextVersion || '1.0.0',
      title: '',
      summary: '',
      items: [emptyItem()],
    }
  }
  return {
    version: release.version,
    title: release.title,
    summary: release.summary ?? '',
    items: release.items.length
      ? release.items.map(item => ({
          category: item.category,
          title: item.title,
          detail: item.detail ?? '',
          feature_key: item.feature_key ?? '',
        }))
      : [emptyItem()],
  }
}

export function PlatformReleaseModal({
  open,
  onClose,
  release,
  nextVersion,
  loading,
  onSubmit,
  onPublish,
}: {
  open: boolean
  onClose: () => void
  release: PlatformRelease | null
  nextVersion: string
  loading: boolean
  onSubmit: (payload: ReleaseFormPayload) => void
  /** Save draft then continue to audience / publish. Draft releases only. */
  onPublish?: (payload: ReleaseFormPayload) => void
}) {
  const [form, setForm] = useState<ReleaseFormPayload>(formFromRelease(null, nextVersion))

  useEffect(() => {
    if (!open) return
    setForm(formFromRelease(release, nextVersion))
  }, [open, release, nextVersion])

  const categories = useMemo(() => form.items.map(item => item.category), [form.items])
  const suggested = suggestNextVersion(nextVersion === form.version ? '' : nextVersion, categories)
  const canPublish = Boolean(onPublish && (!release || release.status === 'draft'))

  const valid = Boolean(
    form.version.trim() &&
    /^\d+\.\d+\.\d+$/.test(form.version.trim()) &&
    form.title.trim() &&
    form.items.some(item => item.title.trim()),
  )

  const setItem = (index: number, patch: Partial<ReleaseFormPayload['items'][number]>) => {
    setForm(current => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={release ? `Edit ${release.version}` : 'New release'}
      subtitle="Customers see this copy. Version is assigned automatically. Publish sends the notice to organisations."
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            loading={loading}
            disabled={!valid || loading}
            onClick={() => onSubmit(form)}
          >
            Save draft
          </Button>
          {canPublish ? (
            <Button loading={loading} disabled={!valid || loading} onClick={() => onPublish?.(form)}>
              Publish
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <Input
          label="Version"
          value={form.version}
          readOnly
          disabled
          placeholder={suggested || '1.0.0'}
        />
        <Input
          label="Title"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Lift matching and register polish"
        />
        <label className="flex flex-col gap-2.5 sm:col-span-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Summary</span>
          <textarea
            value={form.summary}
            onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
            rows={5}
            className="min-h-[7rem] w-full resize-y rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-card px-3 py-2.5 text-sm leading-relaxed text-heading"
            placeholder="Short note for the recipient notice."
          />
        </label>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">What's in this version</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }))}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add change
          </Button>
        </div>
        {form.items.map((item, index) => (
          <div
            key={index}
            className={index === 0
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3'
              : 'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-gray-200 dark:border-gray-700'}
          >
            <Select
              searchable={false}
              label="Category"
              value={item.category}
              onChange={e => setItem(index, { category: e.target.value as ReleaseCategory })}
              options={releaseCategorySelectOptions(item.category)}
            />
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  label="Change title"
                  value={item.title}
                  onChange={e => setItem(index, { title: e.target.value })}
                />
              </div>
              {form.items.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-0.5 h-11 w-11 shrink-0"
                  onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }))}
                  aria-label="Remove change"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <label className="flex flex-col gap-2.5 sm:col-span-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Detail</span>
              <textarea
                value={item.detail}
                onChange={e => setItem(index, { detail: e.target.value })}
                rows={5}
                className="min-h-[7rem] w-full resize-y rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-card px-3 py-2.5 text-sm leading-relaxed text-heading"
              />
            </label>
            {isGatedReleaseCategory(item.category) ? (
              <div className="sm:col-span-2 space-y-2">
                <Input
                  label="Feature key"
                  value={item.feature_key}
                  onChange={e => setItem(index, { feature_key: e.target.value })}
                  placeholder="inventory-lots-v2"
                />
                <p className="text-xs text-muted leading-relaxed">
                  Users can opt in to this enhancement from their inbox. Use a stable key so you can track who enabled it.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted sm:col-span-2 leading-relaxed">
                {RELEASE_CATEGORIES.find(c => c.value === item.category)?.hint ??
                  'Users are notified about what changed; no opt-in required.'}
              </p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
