import { useCallback, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'

export interface SignInCredentialsPayload {
  name?: string
  login_id: string
  username?: string
  email?: string
  temporary_password: string
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

export function PlatformSignInCredentialsModal({
  open,
  onClose,
  payload,
  title = 'Share sign-in details',
}: PlatformSignInCredentialsModalProps) {
  const toast = useToast()
  const [copiedField, setCopiedField] = useState<'login' | 'password' | 'all' | null>(null)

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
    const block = [
      `Sign in to Tradeal`,
      `Email: ${payload.login_id}`,
      `Temporary password: ${payload.temporary_password}`,
    ].join('\n')
    if (await copyText(block)) {
      toast.success('Sign-in details copied')
      flashCopied('all')
    } else {
      toast.error('Could not copy')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      {payload ? (
        <div className="space-y-4">
          <p className="text-sm text-muted leading-relaxed">
            {payload.name ? (
              <>
                Share these details with <span className="font-medium text-heading">{payload.name}</span> securely
                (email, WhatsApp, or phone). This temporary password is shown only once.
              </>
            ) : (
              <>Share these details securely (email, WhatsApp, or phone). This temporary password is shown only once.</>
            )}
          </p>

          <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Sign-in email</p>
                <p className="text-sm font-medium text-heading break-all mt-0.5">{payload.login_id}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyLogin()}>
                {copiedField === 'login' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy
              </Button>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Temporary password</p>
                <p className="text-sm font-mono font-semibold text-heading break-all mt-0.5 tabular-nums">
                  {payload.temporary_password}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyPassword()}>
                {copiedField === 'password' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => void copyAll()}>
              {copiedField === 'all' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy all
            </Button>
            <Button type="button" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
