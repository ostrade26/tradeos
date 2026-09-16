import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Copy, Check, Bell } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../lib/utils'
import { ApiError } from '../../api/client'
import { platformApi } from '../../api/platformApi'

export interface SignInCredentialsPayload {
  name?: string
  login_id: string
  username?: string
  email?: string
  temporary_password: string
  organisation_id?: number
  recipient_user_id?: number
}

interface PlatformSignInCredentialsModalProps {
  open: boolean
  onClose: () => void
  payload: SignInCredentialsPayload | null
  title?: string
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CredentialRow({
  label,
  value,
  mono,
  copied,
  onCopy,
}: {
  label: string
  value: string
  mono?: boolean
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p
          className={cn(
            'text-sm font-semibold text-heading break-all mt-1 leading-snug',
            mono && 'font-mono tabular-nums',
          )}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
          'text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-zinc-800',
          'cursor-pointer attex-focus transition-colors',
        )}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      >
        {copied ? (
          <Check className="h-4 w-4 text-success" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  )
}

export function PlatformSignInCredentialsModal({
  open,
  onClose,
  payload,
  title = 'Share sign-in details',
}: PlatformSignInCredentialsModalProps) {
  const toast = useToast()
  const [copiedField, setCopiedField] = useState<'login' | 'password' | 'all' | null>(null)
  const [notifying, setNotifying] = useState(false)
  const [notified, setNotified] = useState(false)

  useEffect(() => {
    if (open) {
      setCopiedField(null)
      setNotified(false)
    }
  }, [open, payload?.login_id, payload?.temporary_password])

  const flashCopied = useCallback((field: typeof copiedField) => {
    setCopiedField(field)
    window.setTimeout(() => setCopiedField(current => (current === field ? null : current)), 2000)
  }, [])

  const copyLogin = async () => {
    if (!payload) return
    if (await copyText(payload.login_id)) {
      toast.success('Sign-in email copied')
      flashCopied('login')
    } else {
      toast.error('Could not copy')
    }
  }

  const copyPassword = async () => {
    if (!payload) return
    if (await copyText(payload.temporary_password)) {
      toast.success('Temporary password copied')
      flashCopied('password')
    } else {
      toast.error('Could not copy')
    }
  }

  const copyAll = async () => {
    if (!payload) return
    const lines = [`Sign in to Tradeal`, `Email: ${payload.login_id}`, `Temporary password: ${payload.temporary_password}`]
    if (payload.name?.trim()) lines.splice(1, 0, `Name: ${payload.name.trim()}`)
    if (await copyText(lines.join('\n'))) {
      toast.success('Sign-in details copied')
      flashCopied('all')
    } else {
      toast.error('Could not copy')
    }
  }

  const notifyAdmin = async () => {
    if (!payload?.organisation_id || notifying) return
    setNotifying(true)
    try {
      await platformApi.sendNotification({
        organisation_id: payload.organisation_id,
        recipient_user_id: payload.recipient_user_id ?? null,
        kind: 'credentials',
        title: 'Your Tradeal sign-in details',
        body: 'Use these details to sign in. Change your password after you log in.',
        payload: {
          login_id: payload.login_id,
          temporary_password: payload.temporary_password,
        },
      })
      setNotified(true)
      toast.success('Sent to their notifications')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send notification')
    } finally {
      setNotifying(false)
    }
  }

  const recipient = payload?.name?.trim()
  const subtitle: ReactNode = recipient ? (
    <>
      For <span className="font-medium text-heading">{recipient}</span>
    </>
  ) : (
    'Share privately — shown once'
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={payload ? subtitle : undefined}
      size="md"
      footer={
        payload ? (
          <>
            {payload.organisation_id ? (
              <Button
                type="button"
                variant="outline"
                loading={notifying}
                disabled={notified}
                onClick={() => void notifyAdmin()}
              >
                <Bell className="h-4 w-4" aria-hidden />
                {notified ? 'Sent' : 'Notify admin'}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => void copyAll()}>
              {copiedField === 'all' ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              Copy all
            </Button>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </>
        ) : undefined
      }
    >
      {payload ? (
        <div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 -mx-6">
            <CredentialRow
              label="Sign-in email"
              value={payload.login_id}
              copied={copiedField === 'login'}
              onCopy={() => void copyLogin()}
            />
            <CredentialRow
              label="Temporary password"
              value={payload.temporary_password}
              mono
              copied={copiedField === 'password'}
              onCopy={() => void copyPassword()}
            />
          </div>
          <p className="text-xs text-muted leading-relaxed mt-4">
            Copy to share privately, or send to their Tradeal notifications. They can open it later from the bell.
          </p>
        </div>
      ) : null}
    </Modal>
  )
}
