import { useEffect, useMemo, useState } from 'react'
import { platformFeatureIcon as FeatureIcon } from '../../lib/platformProductIcons'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { noticeChangelog } from '../../lib/notificationDisplay'
import { releaseCategoryLabel, isGatedReleaseCategory } from '../../lib/releaseVersion'
import { RichTextContent } from '../ui/RichTextContent'
import type { UserNotification } from '../../api/platformApi'

type EnhancementOption = {
  featureKey: string
  title: string
  detail: string
  category: string
  alreadyEnabled: boolean
}

function payloadText(payload: Record<string, string>, key: string): string {
  return String(payload[key] ?? '').trim()
}

function optionsFromNotice(
  item: UserNotification,
  appliedKeys: string[],
): EnhancementOption[] {
  const applied = new Set(appliedKeys.map(k => k.toLowerCase()))
  const parsed = noticeChangelog(item.payload)
  if (parsed.length) {
    const fromChangelog = parsed
      .filter(entry => isGatedReleaseCategory(entry.category) || entry.featureKey)
      .map(entry => {
        if (!entry.featureKey) return null
        return {
          featureKey: entry.featureKey,
          title: entry.title,
          detail: entry.detail,
          category: entry.category || 'feature_enhancement',
          alreadyEnabled: applied.has(entry.featureKey.toLowerCase()),
        }
      })
      .filter((row): row is EnhancementOption => row != null)
    if (fromChangelog.length) return fromChangelog
  }
  const keys = payloadText(item.payload, 'feature_keys')
    .split('\n')
    .map(k => k.trim())
    .filter(Boolean)
  const titles = payloadText(item.payload, 'items').split('\n').map(t => t.trim()).filter(Boolean)
  return keys.map((featureKey, index) => ({
    featureKey,
    title: titles[index] || featureKey,
    detail: '',
    category: 'feature_enhancement',
    alreadyEnabled: applied.has(featureKey.toLowerCase()),
  }))
}

export function FeatureEnhancementModal({
  open,
  notice,
  appliedKeys,
  loading,
  onClose,
  onEnable,
}: {
  open: boolean
  notice: UserNotification | null
  appliedKeys: string[]
  loading: boolean
  onClose: () => void
  onEnable: (notificationId: number, featureKeys: string[]) => Promise<void>
}) {
  const options = useMemo(
    () => (notice ? optionsFromNotice(notice, appliedKeys) : []),
    [notice, appliedKeys],
  )
  const selectable = options.filter(o => !o.alreadyEnabled)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) {
      setSelected(new Set())
      return
    }
    setSelected(new Set())
  }, [open, notice?.id])

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const canSubmit = selectable.length > 0 && selected.size > 0 && !loading

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={notice?.title ?? 'Feature enhancements'}
      subtitle="Choose what to enable on your account. You can turn on one or many."
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Not now
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            loading={loading}
            onClick={() => notice && void onEnable(notice.id, [...selected])}
          >
            Enable selected
          </Button>
        </div>
      }
    >
      {options.length === 0 ? (
        <p className="text-sm text-muted">No enhancements listed in this notice.</p>
      ) : (
        <ul className="space-y-4">
          {options.map(option => {
            const disabled = option.alreadyEnabled
            const checked = disabled || selected.has(option.featureKey)
            return (
              <li
                key={option.featureKey}
                className="flex gap-3 rounded-md border border-gray-200 dark:border-gray-700 px-4 py-3"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled || loading}
                  onChange={() => toggle(option.featureKey)}
                  aria-label={`Enable ${option.title}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <FeatureIcon className="h-4 w-4 shrink-0 text-accent mt-0.5" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-heading">{option.title}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {releaseCategoryLabel(option.category)}
                        {disabled ? ' · Already enabled' : ''}
                      </p>
                      {option.detail ? (
                        <RichTextContent value={option.detail} className="mt-2 text-muted" />
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
