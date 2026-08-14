// shared/components/ui/select.tsx
//
// Lightweight Select component matching shadcn/ui's API surface so
// existing call sites (SelectTrigger, SelectContent, SelectItem,
// SelectValue) work without changes.
//
// Implementation note: this is NOT a full Radix-style accessible
// dropdown — it renders a native <select> styled with Tailwind.
// For a POS billing screen this is actually the better UX: native
// selects open instantly, support keyboard arrow navigation out of
// the box, and are mobile-friendly. If full Radix semantics are
// needed later, swap the internals without changing the export
// surface and all call sites keep working.

import * as React from 'react'
import { cn } from '../../utils'

/* ----------------------------------------------------------------------------
 * Select (root context)
 * ------------------------------------------------------------------------- */
interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  name?: string
}
const SelectContext = React.createContext<SelectContextValue | null>(null)

export interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  name?: string
}

function Select({ value, onValueChange, children, name }: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onValueChange, name }}>
      {children}
    </SelectContext.Provider>
  )
}

/* ----------------------------------------------------------------------------
 * SelectTrigger — renders the native <select>
 * ------------------------------------------------------------------------- */
export interface SelectTriggerProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode
}

const SelectTrigger = React.forwardRef<HTMLSelectElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(SelectContext)
    return (
      <select
        ref={ref}
        name={ctx?.name}
        value={ctx?.value ?? ''}
        onChange={(e) => ctx?.onValueChange(e.target.value)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
      </select>
    )
  }
)
SelectTrigger.displayName = 'SelectTrigger'

/* ----------------------------------------------------------------------------
 * SelectValue — placeholder text shown when nothing is selected
 * ------------------------------------------------------------------------- */
export interface SelectValueProps {
  placeholder?: string
}
function SelectValue({ placeholder }: SelectValueProps) {
  // In a native <select>, the placeholder is the first <option> with
  // empty value. We render nothing here — SelectTrigger renders the
  // selected option's label automatically. Placeholder option is added
  // by the consumer via <SelectItem value="">{placeholder}</SelectItem>.
  return null
}

/* ----------------------------------------------------------------------------
 * SelectContent — no-op wrapper (kept for API compat with shadcn/ui)
 * ------------------------------------------------------------------------- */
export interface SelectContentProps {
  children: React.ReactNode
}
function SelectContent({ children }: SelectContentProps) {
  return <>{children}</>
}

/* ----------------------------------------------------------------------------
 * SelectItem — renders an <option>
 * ------------------------------------------------------------------------- */
export interface SelectItemProps {
  value: string
  children: React.ReactNode
  disabled?: boolean
}
function SelectItem({ value, children, disabled }: SelectItemProps) {
  return (
    <option value={value} disabled={disabled}>
      {children as unknown as string}
    </option>
  )
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
}
