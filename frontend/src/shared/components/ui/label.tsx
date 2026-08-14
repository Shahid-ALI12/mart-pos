// shared/components/ui/label.tsx
//
// Minimal <Label> wrapper around <label> with Tailwind styling that
// matches the rest of the UI kit. Forwarded ref lets it be used as a
// drop-in for shadcn/ui's Label component.
//
// Why a hand-written stub instead of pulling @radix-ui/react-label?
// The rest of the UI kit (button.tsx, card.tsx, input.tsx) is also
// hand-written with plain Tailwind classes — no Radix dependency
// tree. Keeping that pattern keeps the bundle small and avoids
// pulling in a runtime dep just for a styled <label>.

import * as React from 'react'
import { cn } from '../../utils'

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  )
)
Label.displayName = 'Label'

export { Label }
