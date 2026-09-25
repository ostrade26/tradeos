import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { authApi } from '../api/tradeApi'
import { ApiError } from '../api/client'
import { tradealCopyright } from '../lib/copyright'
import { TradealMark } from '../components/brand/TradealMark'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setError(
          'Cannot reach the Tradeal API. Confirm the API is running and try again.',
        )
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Could not send reset email')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-viewport overflow-y-auto overscroll-contain bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent mb-4">
            <TradealMark tone="white" className="h-7 w-7" title="" />
          </div>
          <h1 className="text-2xl font-semibold text-heading">Forgot password</h1>
          <p className="text-sm text-muted mt-2">
            Enter the email on your Tradeal account and we will send a reset link.
          </p>
        </div>

        {sent ? (
          <div className="rounded-md bg-card shadow-[var(--shadow-card)] p-8 space-y-4">
            <p className="text-sm text-heading leading-relaxed">
              If an account exists for that email, we sent a password reset link. Check your inbox
              (and spam folder). The link expires in one hour.
            </p>
            <Link
              to="/login"
              className="inline-flex text-sm font-medium text-accent hover:text-accent-hover"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-md bg-card shadow-[var(--shadow-card)] p-8 space-y-4"
          >
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
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
              disabled={submitting || !email.trim()}
            >
              <Mail className="h-4 w-4" />
              {submitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center space-y-3">
          {!sent ? (
            <Link to="/login" className="text-sm font-medium text-accent hover:text-accent-hover">
              Back to sign in
            </Link>
          ) : null}
          <p className="text-xs text-muted">{tradealCopyright()}</p>
        </div>
      </div>
    </div>
  )
}
