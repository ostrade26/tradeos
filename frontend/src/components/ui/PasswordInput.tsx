import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './Input'
import type { ComponentProps } from 'react'

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'trailing'>

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-heading hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer attex-focus"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      }
    />
  )
}
