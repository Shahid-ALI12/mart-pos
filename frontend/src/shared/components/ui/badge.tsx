// shared/components/ui/badge.tsx
//
// Small pill-style indicator. Variants match the project's color
// tokens (primary-600 / red-600 / gray-100 etc.) so it composes
// cleanly with the rest of the UI kit.
//
// Usage:
//   <Badge variant="default">Active</Badge>
//   <Badge variant="destructive">Overdue</Badge>

import * as React from 'react'
import { cn } from '../../utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success'
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'border-transparent bg-primary-600 text-white',
  secondary: 'border-transparent bg-gray-100 text-gray-900',
  destructive: 'border-transparent bg-red-600 text-white',
  outline: 'text-gray-900 border border-gray-300',
  success: 'border-transparent bg-green-600 text-white',
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
)
Badge.displayName = 'Badge'

export { Badge }
