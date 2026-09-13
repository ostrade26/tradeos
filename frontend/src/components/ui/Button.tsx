import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-sm border border-transparent',
  secondary: 'border border-accent/40 bg-accent-muted text-accent hover:bg-accent/15 hover:border-accent dark:border-accent/50 dark:bg-accent/10 dark:text-accent dark:hover:bg-accent/20 dark:hover:border-accent/70',
  outline: 'border border-accent/40 bg-white text-accent hover:bg-accent-muted hover:border-accent dark:border-accent/50 dark:bg-card dark:text-accent dark:hover:bg-accent/10',
  outlineDanger: 'border border-danger/30 bg-white text-danger hover:bg-danger/5 hover:border-danger/50 dark:border-danger/40 dark:bg-card dark:hover:border-danger/50 dark:hover:bg-danger/10',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-accent dark:text-muted dark:hover:bg-gray-700/50 dark:hover:text-accent',
  danger: 'bg-danger text-white hover:bg-red-600 border border-transparent shadow-sm',
}

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
  icon: 'h-11 w-11 p-0',
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
  to?: string
  onClick?: React.MouseEventHandler<HTMLElement>
}

export const buttonStyles = (
  variant: keyof typeof variants = 'primary',
  size: keyof typeof sizes = 'md',
  className?: string,
) => cn(
  'inline-flex items-center justify-center rounded-md font-medium transition-all duration-150',
  'attex-focus disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
  variants[variant],
  sizes[size],
  className,
)

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, to, onClick, ...props }, ref) => {
    const classes = buttonStyles(variant, size, className)

    if (to) {
      return (
        <Link
          to={to}
          className={cn(classes, (disabled || loading) && 'opacity-50 pointer-events-none')}
          onClick={disabled || loading ? undefined : onClick}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {children}
        </Link>
      )
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classes}
        onClick={onClick}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
