import { Link } from 'react-router-dom'

export function DashboardMetricLink({ to, label, value }: { to: string; label: string; value: number }) {
  return (
    <Link
      to={to}
      className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-3 text-center hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
    >
      <p className="text-xl font-semibold tabular-nums text-heading">{value}</p>
      <p className="text-sm text-caption mt-1">{label}</p>
    </Link>
  )
}
