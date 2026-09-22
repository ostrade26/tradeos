import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PasswordInput } from '../components/ui/PasswordInput'
import { authApi } from '../api/tradeApi'
import { ApiError } from '../api/client'
import { tradealCopyright } from '../lib/copyright'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams])

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('This reset link is missing a token. Request a new one from the sign-in page.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters')
      return
    }

    setSubmitting(true)
    try {
      await authApi.resetPassword(token, newPassword)
      navigate('/login', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setError(
          'Cannot reach the Tradeal API. Confirm the API is running and try again.',
        )
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Could not reset password')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="h-viewport overflow-y-auto overscroll-contain bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white font-bold text-lg mb-4">
            T
          </div>
          <h1 className="text-2xl font-semibold text-heading">Invalid reset link</h1>
          <p className="text-sm text-muted mt-2 mb-6">
            This link is incomplete or expired. Request a new password reset.
          </p>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-accent hover:text-accent-hover"
          >
            Forgot password
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-viewport overflow-y-auto overscroll-contain bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white font-bold text-lg mb-4">
            T
          </div>
          <h1 className="text-2xl font-semibold text-heading">Choose a new password</h1>
          <p className="text-sm text-muted mt-2">
            Enter a new password for your Tradeal account.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-md bg-card shadow-[var(--shadow-card)] p-6 space-y-4"
        >
          <PasswordInput
            label="New password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            required
          />
          <PasswordInput
            label="Confirm new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || newPassword.length < 4 || !confirmPassword}
          >
            <KeyRound className="h-4 w-4" />
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <Link to="/login" className="text-sm font-medium text-accent hover:text-accent-hover">
            Back to sign in
          </Link>
          <p className="text-xs text-muted">{tradealCopyright()}</p>
        </div>
      </div>
    </div>
  )
}
