import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { releaseCategoryLabel, isGatedReleaseCategory } from '../../lib/releaseVersion'
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
  const raw = payloadText(item.payload, 'changelog')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        category?: string
        title?: string
        detail?: string
        feature_key?: string
      }[]
      if (Array.isArray(parsed)) {
        return parsed
          .filter(entry => isGatedReleaseCategory(String(entry.category || '')) || entry.feature_key)
          .map(entry => {
            const featureKey = String(entry.feature_key || '').trim()
            const title = String(entry.title || '').trim()
            if (!featureKey || !title) return null
            return {
              featureKey,
              title,
              detail: String(entry.detail || '').trim(),
              category: String(entry.category || 'feature_enhancement'),
              alreadyEnabled: applied.has(featureKey.toLowerCase()),
            }
          })
          .filter((row): row is EnhancementOption => row != null)
      }
    } catch {
      /* fall through */
    }
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
                    <Sparkles className="h-4 w-4 shrink-0 text-accent mt-0.5" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-heading">{option.title}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {releaseCategoryLabel(option.category)}
                        {disabled ? ' · Already enabled' : ''}
                      </p>
                      {option.detail ? (
                        <p className="text-sm text-muted mt-2 leading-relaxed">{option.detail}</p>
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
