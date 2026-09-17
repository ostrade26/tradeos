import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'
import { copyServiceIssueReport, type ServiceIssueView } from '../../lib/serviceIssue'
import { apiBaseForDiagnostics } from '../../api/client'

export function ServiceIssueCopyButton({ issue }: { issue: ServiceIssueView }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await copyServiceIssueReport(issue, apiBaseForDiagnostics())
      setCopied(true)
      toast.success('Error details copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select and copy manually')
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 gap-2 bg-white/80 dark:bg-zinc-900/80"
      onClick={() => void onCopy()}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? 'Copied' : 'Copy error details'}
    </Button>
  )
}
