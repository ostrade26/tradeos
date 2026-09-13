import { forwardRef, useEffect, useState, type FocusEvent, type ChangeEvent } from 'react'
import { Input } from './Input'
import {
  formatIndianAmount,
  formatIndianAmountEditing,
  indianAmountForEditing,
} from '../../lib/indianAmount'

interface AmountInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: string
  onChange: (value: string) => void
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  ({ value, onChange, onBlur, onFocus, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const [draft, setDraft] = useState('')

    useEffect(() => {
      if (!focused) {
        setDraft(value ? formatIndianAmount(value) : '')
      }
    }, [value, focused])

    const displayValue = focused ? draft : (value ? formatIndianAmount(value) : '')

    const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
      setFocused(true)
      setDraft(indianAmountForEditing(value))
      onFocus?.(e)
    }

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const next = formatIndianAmountEditing(e.target.value)
      if (next === null) return
      setDraft(next)
      onChange(next)
    }

    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      setFocused(false)
      const final = draft ? formatIndianAmount(draft) : ''
      setDraft(final)
      if (final !== value) onChange(final)
      onBlur?.(e)
    }

    return (
      <Input
        ref={ref}
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={displayValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    )
  },
)
AmountInput.displayName = 'AmountInput'
