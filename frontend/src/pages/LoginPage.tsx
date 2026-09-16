import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { useAuth } from '../hooks/useAuth'
import { loadAuthSession } from '../lib/auth'
import { ApiError } from '../api/client'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username.trim(), password)
      const saved = loadAuthSession()
      const defaultHome = saved?.isPlatformAdmin ? '/platform-admin/organisations' : '/'
      const dest = from && from !== '/' && from !== '/login' ? from : defaultHome
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in')
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
          <p className="text-sm text-muted mt-2">Sign in with your organisation email and password</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-md bg-card shadow-[var(--shadow-card)] p-6 space-y-4"
        >
          <Input
            label="Email"
            type="email"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="email"
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

        <div className="mt-6 rounded-md border border-gray-200 dark:border-gray-700 bg-card/60 px-4 py-3 text-sm text-muted leading-relaxed">
          <p className="font-medium text-heading text-sm mb-1">Forgot email or password?</p>
          <p>
            Sign-in uses your <span className="text-heading">organisation email</span>. Ask your organisation admin
            to reset your password from Settings → Team, or contact Tradeal if you are the only admin.
          </p>
        </div>
      </div>
    </div>
  )
}
