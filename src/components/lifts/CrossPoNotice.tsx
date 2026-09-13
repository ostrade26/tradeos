interface CrossPoNoticeProps {
  messages: string[]
  compact?: boolean
}

export function CrossPoNotice({ messages, compact }: CrossPoNoticeProps) {
  if (messages.length === 0) return null

  if (compact) {
    return (
      <p className="text-xs text-warning leading-relaxed">
        {messages[0]}
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <p className="text-sm font-medium text-heading">Dispatching from a different lot</p>
      <p className="text-xs text-muted mt-1">
        The buyer came first for delivery — stock is drawn from another PO with the same seller.
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-muted list-disc pl-4">
        {messages.map(message => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  )
}
