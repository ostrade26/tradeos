import { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Checkbox } from '../components/ui/Checkbox'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Modal } from '../components/ui/Drawer'
import { useAuth } from '../hooks/useAuth'
import {
  loadAuthSession,
  loadKeepSignedIn,
  loadRememberedUsername,
} from '../lib/auth'
import { consumeLoginNotice, LOGIN_NOTICE_COPY } from '../lib/loginNotice'
import { APP_HOME } from '../lib/appShellMode'
import { ApiError } from '../api/client'
import type { AuthSession } from '../lib/auth'
import { tradealCopyright } from '../lib/copyright'

function homeAfterLogin(session: AuthSession | null): string {
  return session?.isPlatformAdmin ? '/platform-admin/organisations' : APP_HOME
}

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState(() => loadRememberedUsername())
  const [password, setPassword] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(() => loadKeepSignedIn())
  const [helpOpen, setHelpOpen] = useState(false)
  const [loginNotice] = useState(() => {
    const code = consumeLoginNotice()
    return code ? LOGIN_NOTICE_COPY[code] : null
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={homeAfterLogin(loadAuthSession())} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username.trim(), password, { keepSignedIn })
      navigate(homeAfterLogin(loadAuthSession()), { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setError(
          'Cannot reach the Tradeal API. Run npm run dev:all, open http://127.0.0.1:5173, and confirm http://127.0.0.1:8000/api/v1/health returns JSON.',
        )
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Could not sign in')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-viewport overflow-y-auto overscroll-contain bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white font-bold text-lg mb-4">
            T
          </div>
          <h1 className="text-2xl font-semibold text-heading">Sign in to Tradeal</h1>
          <p className="text-sm text-muted mt-2">Use your login ID and password</p>
        </div>

        {loginNotice ? (
          <div
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/40"
            role="status"
          >
            <p className="font-medium text-heading">{loginNotice.title}</p>
            <p className="text-muted mt-1 leading-relaxed">{loginNotice.body}</p>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="rounded-md bg-card shadow-[var(--shadow-card)] p-6 space-y-4"
        >
          <Input
            label="Username or email"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <div className="flex items-center justify-between gap-3">
            <Checkbox
              label="Keep me signed in"
              checked={keepSignedIn}
              onChange={e => setKeepSignedIn(e.target.checked)}
              tight
            />
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="text-sm font-medium text-accent hover:text-accent-hover cursor-pointer attex-focus shrink-0"
            >
              Need help?
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting || !username.trim() || !password}>
            <LogIn className="h-4 w-4" />
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <Link to="/" className="text-sm font-medium text-accent hover:text-accent-hover cursor-pointer">
            Back to Tradeal
          </Link>
          <p className="text-xs text-muted">{tradealCopyright()}</p>
        </div>
      </div>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Need help signing in?"
        size="sm"
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setHelpOpen(false)}>Got it</Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            After a platform password reset, use the modal{' '}
            <span className="font-medium text-heading">Login ID</span> and{' '}
            <span className="font-medium text-heading">temporary password</span> exactly
            (Copy all).
          </p>
          <p>
            Wrong password shows &quot;Invalid username or password&quot; — not a timeout.
          </p>
          <p>
            Ask your organisation admin or another Tradeal admin if you need a password reset.
          </p>
        </div>
      </Modal>
    </div>
  )
}
