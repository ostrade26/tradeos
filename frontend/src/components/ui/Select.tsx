import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect'

export type { SearchableSelectOption }

interface SelectProps {
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  options: { value: string; label: string; description?: string; keywords?: string }[]
  value?: string
  /** Shown when value is not in options (e.g. legacy free-text). */
  displayLabel?: string
  onChange?: (e: { target: { value: string } }) => void
  searchable?: boolean
  allowCustom?: boolean
  allowCreate?: boolean
  onCreate?: (name: string) => SearchableSelectOption | Promise<SearchableSelectOption>
  createLabel?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  error?: string
  compact?: boolean
}

export function Select({
  label,
  placeholder,
  searchPlaceholder,
  options,
  value = '',
  displayLabel,
  onChange,
  searchable = true,
  allowCustom = false,
  allowCreate = false,
  onCreate,
  createLabel,
  emptyMessage,
  disabled,
  error,
  className,
  compact,
}: SelectProps) {
  const placeholderOption = options.find(o => o.value === '')
  const listOptions: SearchableSelectOption[] = options
    .filter(o => o.value !== '')
    .map(o => ({
      value: o.value,
      label: o.label,
      description: o.description,
      keywords: o.keywords,
    }))

  const selected = listOptions.find(o => o.value === value)

  return (
    <SearchableSelect
      className={className}
      compact={compact}
      label={label}
      placeholder={placeholder ?? placeholderOption?.label ?? 'Select...'}
      searchPlaceholder={searchPlaceholder ?? `Search${label ? ` ${label.toLowerCase()}` : ''}...`}
      options={listOptions}
      value={value}
      displayLabel={selected?.label || displayLabel || value}
      searchable={searchable}
      allowCustom={allowCustom}
      allowCreate={allowCreate}
      onCreate={onCreate}
      createLabel={createLabel}
      emptyMessage={emptyMessage ?? 'No matches found'}
      disabled={disabled || (listOptions.length === 0 && !allowCustom && !allowCreate)}
      error={error}
      onValueChange={(v, lbl) => {
        onChange?.({ target: { value: v || lbl } })
      }}
    />
  )
}
