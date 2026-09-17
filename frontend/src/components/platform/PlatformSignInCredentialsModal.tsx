import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Copy, Check, Bell } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../lib/utils'
import { ApiError } from '../../api/client'
import { platformApi } from '../../api/platformApi'
import { loginUsernameError } from '../../lib/username'

export interface SignInCredentialsPayload {
  name?: string
  login_id: string
  username?: string
  email?: string
  temporary_password?: string
  organisation_id?: number
  recipient_user_id?: number
}

interface PlatformSignInCredentialsModalProps {
  open: boolean
  onClose: () => void
  payload: SignInCredentialsPayload | null
  title?: string
  generatingPassword?: boolean
  onGeneratePassword?: (username: string) => void
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
  muted,
}: {
  label: string
  value: string
  mono?: boolean
  copied?: boolean
  onCopy?: () => void
  muted?: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p
          className={cn(
            'text-sm font-semibold break-all mt-1 leading-snug',
            mono && 'font-mono tabular-nums',
            muted ? 'text-muted font-medium' : 'text-heading',
          )}
        >
          {value}
        </p>
      </div>
      {onCopy ? (
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
      ) : null}
    </div>
  )
}

export function PlatformSignInCredentialsModal({
  open,
  onClose,
  payload,
  title = 'Share sign-in details',
  generatingPassword = false,
  onGeneratePassword,
}: PlatformSignInCredentialsModalProps) {
  const toast = useToast()
  const [copiedField, setCopiedField] = useState<'login' | 'password' | 'all' | null>(null)
  const [notifying, setNotifying] = useState(false)
  const [notified, setNotified] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const password = payload?.temporary_password
  const pendingGenerate = Boolean(payload && !password && onGeneratePassword)
  const currentUsername = (payload?.username || payload?.login_id || '').trim()
  const usernameError = pendingGenerate ? loginUsernameError(usernameDraft, { allowCurrent: currentUsername }) : null

  useEffect(() => {
    if (open) {
      setCopiedField(null)
      setNotified(false)
      setUsernameDraft(payload?.username || payload?.login_id || '')
    }
  }, [open, payload?.login_id, payload?.username, password])

  const flashCopied = useCallback((field: typeof copiedField) => {
    setCopiedField(field)
    window.setTimeout(() => setCopiedField(current => (current === field ? null : current)), 2000)
  }, [])

  const copyLogin = async () => {
    if (!payload) return
    if (await copyText(payload.login_id)) {
      toast.success('Username copied')
      flashCopied('login')
    } else {
      toast.error('Could not copy')
    }
  }

  const copyPassword = async () => {
    if (!password) return
    if (await copyText(password)) {
      toast.success('Temporary password copied')
      flashCopied('password')
    } else {
      toast.error('Could not copy')
    }
  }

  const copyAll = async () => {
    if (!payload || !password) return
    const lines = [`Sign in to Tradeal`, `Username: ${payload.login_id}`, `Temporary password: ${password}`]
    if (payload.name?.trim()) lines.splice(1, 0, `Name: ${payload.name.trim()}`)
    if (await copyText(lines.join('\n'))) {
      toast.success('Sign-in details copied')
      flashCopied('all')
    } else {
      toast.error('Could not copy')
    }
  }

  const notifyAdmin = async () => {
    if (!payload?.organisation_id || !password || notifying) return
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
          temporary_password: password,
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
    pendingGenerate ? 'Shown once after you generate it' : 'Share privately — shown once'
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pendingGenerate ? 'Reset login' : title}
      subtitle={payload ? subtitle : undefined}
      size="md"
      footer={
        payload ? (
          pendingGenerate ? (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={generatingPassword}>
                Cancel
              </Button>
              <Button
                type="button"
                loading={generatingPassword}
                disabled={Boolean(usernameError)}
                onClick={() => onGeneratePassword?.(usernameDraft.trim().toLowerCase())}
              >
                Save username & generate password
              </Button>
            </>
          ) : (
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
          )
        ) : undefined
      }
    >
      {payload ? (
        <div>
          <div className="space-y-4">
            {pendingGenerate ? (
              <Input
                label="Username"
                value={usernameDraft}
                onChange={e => setUsernameDraft(e.target.value)}
                error={usernameError ?? undefined}
                autoComplete="off"
              />
            ) : (
              <CredentialRow
                label="Username"
                value={payload.login_id}
                copied={copiedField === 'login'}
                onCopy={() => void copyLogin()}
              />
            )}
            {password ? (
              <CredentialRow
                label="Temporary password"
                value={password}
                mono
                copied={copiedField === 'password'}
                onCopy={() => void copyPassword()}
              />
            ) : (
              <CredentialRow
                label="Temporary password"
                value="Not generated yet"
                muted
              />
            )}
          </div>
          {pendingGenerate ? (
            <p className="text-xs text-muted leading-relaxed mt-4">
              You can change their username, then generate a temporary password. They will be signed out.
            </p>
          ) : (
            <p className="text-xs text-muted leading-relaxed mt-4">
              Copy to share privately, or send to their Tradeal notifications. They can open it later from the bell.
            </p>
          )}
        </div>
      ) : null}
    </Modal>
  )
}

