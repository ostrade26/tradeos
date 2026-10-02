export function TankerNumberList({
  tankers,
}: {
  tankers: { number: string; changed?: boolean; previous?: string }[]
}) {
  const visible = tankers.filter(tanker => tanker.number.trim() || tanker.changed)
  if (visible.length === 0) return <span>—</span>
  return (
    <span className="flex flex-col items-start gap-1">
      {visible.map((tanker, index) => (
        <span
          key={`${tanker.number}-${index}`}
          title={tanker.previous ? `Was ${tanker.previous}` : undefined}
          className={
            tanker.changed
              ? 'inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
              : undefined
          }
        >
          {tanker.number || '—'}
        </span>
      ))}
    </span>
  )
}
