import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ImagePlus } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { organisationApi } from '../../api/organisationApi'
import type { ProductRequest, ProductRequestAttachment, ProductRequestKind, ProductRequestPriority } from '../../api/platformApi'
import { ApiError } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { captureFeedbackPagePath } from '../../lib/feedbackPagePath'
import { fileToScreenshot, SCREENSHOT_MAX } from '../../lib/screenshotAttach'
import { ScreenshotStrip } from './ScreenshotStrip'

/** Recipients available for “Send request”. More parties (broker, etc.) can be added later. */
export type RequestRecipientId = 'tradeal'

export const REQUEST_RECIPIENT_OPTIONS: {
  value: RequestRecipientId
  label: string
  description: string
}[] = [
  {
    value: 'tradeal',
    label: 'Tradeal',
    description: 'Product team — issues, improvements, and new needs',
  },
]

export function requestRecipientLabel(id: string | undefined): string {
  return REQUEST_RECIPIENT_OPTIONS.find(o => o.value === id)?.label || id || '—'
}

const KIND_OPTIONS: { value: ProductRequestKind; label: string }[] = [
  { value: 'issue', label: 'Issue' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'requirement', label: 'New need' },
]

const PRIORITY_OPTIONS: { value: ProductRequestPriority; label: string; description: string }[] = [
  { value: 'p1', label: 'P1 · Critical', description: 'Work is blocked' },
  { value: 'p2', label: 'P2 · High', description: 'Painful, but there is a workaround' },
  { value: 'p3', label: 'P3 · Normal', description: 'Can wait' },
]

export function SendToTradealModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean
  onClose: () => void
  onSent?: (request: ProductRequest) => void
}) {
  const location = useLocation()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [to, setTo] = useState<RequestRecipientId>('tradeal')
  const [kind, setKind] = useState<ProductRequestKind>('issue')
  const [priority, setPriority] = useState<ProductRequestPriority>('p3')
  const [message, setMessage] = useState('')
  const [screenshots, setScreenshots] = useState<ProductRequestAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [attaching, setAttaching] = useState(false)

  useEffect(() => {
    if (!open) {
      setTo('tradeal')
      setKind('issue')
      setPriority('p3')
      setMessage('')
      setScreenshots([])
    }
  }, [open])

  const valid = Boolean(to) && message.trim().length >= 8

  const addScreenshots = async (files: FileList | null) => {
    if (!files?.length || attaching) return
    const room = SCREENSHOT_MAX - screenshots.length
    if (room <= 0) {
      toast.error('Up to 3 screenshots')
      return
    }
    setAttaching(true)
    try {
      const next: ProductRequestAttachment[] = []
      for (const file of Array.from(files).slice(0, room)) {
        next.push(await fileToScreenshot(file))
      }
      setScreenshots(list => [...list, ...next].slice(0, SCREENSHOT_MAX))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not attach screenshot')
    } finally {
      setAttaching(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = async () => {
    if (!valid || sending) return
    if (to !== 'tradeal') {
      toast.error('That recipient is not available yet')
      return
    }
    setSending(true)
    try {
      const res = await organisationApi.createProductRequest({
        kind,
        priority,
        message: message.trim(),
        page_path: captureFeedbackPagePath(location.pathname, location.search),
        attachments: screenshots,
      })
      setMessage('')
      setScreenshots([])
      toast.success(`Request sent to ${requestRecipientLabel(to)}`)
      onSent?.(res.request)
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send request"
      subtitle="Choose who should receive this, then describe the issue, improvement, or new need."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Close
          </Button>
          <Button loading={sending} disabled={!valid || sending} onClick={() => void submit()}>
            Send
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Select
          label="To"
          searchable={false}
          options={REQUEST_RECIPIENT_OPTIONS}
          value={to}
          onChange={e => setTo(e.target.value as RequestRecipientId)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Type"
            searchable={false}
            options={KIND_OPTIONS}
            value={kind}
            onChange={e => setKind(e.target.value as ProductRequestKind)}
          />
          <Select
            label="Priority"
            searchable={false}
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={e => setPriority(e.target.value as ProductRequestPriority)}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">What happened *</span>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={5}
            maxLength={2000}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-heading placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 dark:border-gray-600 dark:bg-card"
            placeholder="A few lines is enough."
          />
        </label>
        <div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Screenshots</span>
          <p className="mt-0.5 text-xs text-muted">Optional. Up to 3 images.</p>
          <ScreenshotStrip
            shots={screenshots}
            size="sm"
            onRemove={index => setScreenshots(list => list.filter((_, i) => i !== index))}
          />
          {screenshots.length < SCREENSHOT_MAX ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="sr-only"
                onChange={e => void addScreenshots(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                loading={attaching}
                disabled={attaching || sending}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                Attach screenshot
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
