import { cn, noAutofill } from '../../lib/utils'
import type { BrokerageInputType } from '../../lib/orderForm'

interface BrokerageInputProps {
  label?: string
  mode: BrokerageInputType
  value: string
  onModeChange: (mode: BrokerageInputType) => void
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

const MODE_LABEL: Record<BrokerageInputType, string> = {
  percent: '%',
  perTon: '₹/MT',
}

function sanitizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join('')}`
}

export function BrokerageInput({
  label = 'Brokerage',
  mode,
  value,
  onModeChange,
  onChange,
  placeholder,
  disabled = false,
}: BrokerageInputProps) {
  const toggleMode = () => {
    onModeChange(mode === 'percent' ? 'perTon' : 'percent')
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          {...noAutofill}
          value={value}
          disabled={disabled}
          placeholder={placeholder ?? (mode === 'percent' ? 'e.g. 0.5' : 'e.g. 75')}
          onChange={e => onChange(sanitizeDecimalInput(e.target.value))}
          className={cn(
            'h-9 w-full rounded-md border border-gray-200 bg-white pl-3 pr-[4.25rem] text-sm text-heading',
            'placeholder:text-placeholder transition-colors duration-150',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
            'dark:border-gray-600 dark:bg-card dark:text-heading',
            disabled && 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50',
          )}
        />
        <button
          type="button"
          onClick={toggleMode}
          disabled={disabled}
          title={mode === 'percent' ? 'Switch to amount (₹/MT)' : 'Switch to percentage (%)'}
          className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2 h-7 min-w-[3.25rem] px-2 rounded',
            'text-xs font-semibold tabular-nums',
            'bg-gray-100 text-gray-600 hover:bg-gray-200',
            'dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
            'transition-colors duration-150',
          )}
        >
          {MODE_LABEL[mode]}
        </button>
      </div>
    </div>
  )
}
