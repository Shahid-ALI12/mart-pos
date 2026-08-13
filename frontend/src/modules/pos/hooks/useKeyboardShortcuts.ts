// modules/pos/hooks/useKeyboardShortcuts.ts
//
// Registers the POS function-key shortcuts on mount and tears them down on
// unmount. Extracted from the 787-line POS.tsx so the main component can
// focus on layout, and so the shortcut wiring is unit-testable in isolation.
//
// Shortcuts:
//   F1   Open payment modal          (only if cart non-empty)
//   F2   Hold bill modal              (only if cart non-empty)
//   F3   Customer search modal
//   F4   Toggle return mode
//   Esc  Close any open modal
//   /[0-9*]/  Route numeric input to the hidden barcode field
//             (so the USB barcode scanner works without the user
//             manually focusing a text input).
//
// The handlers are passed in as a ref so the listener stays stable across
// re-renders (we add/remove the window listener only once).

import { useEffect, useRef } from 'react'

export interface KeyboardShortcutHandlers {
  onOpenPayment: () => void
  onOpenHold: () => void
  onOpenCustomer: () => void
  onToggleReturnMode: () => void
  onCloseModals: () => void
  onBarcodeKey: () => void
  isCartEmpty: () => boolean
  isReturnMode: () => boolean
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  // Keep a ref to the latest handlers so the listener we attach on mount
  // always sees the freshest callbacks without needing to re-subscribe.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current

      if (e.key === 'F1') {
        e.preventDefault()
        if (!h.isCartEmpty()) h.onOpenPayment()
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        if (!h.isCartEmpty()) h.onOpenHold()
        return
      }
      if (e.key === 'F3') {
        e.preventDefault()
        h.onOpenCustomer()
        return
      }
      if (e.key === 'F4') {
        e.preventDefault()
        h.onToggleReturnMode()
        return
      }
      if (e.key === 'Escape') {
        h.onCloseModals()
        return
      }
      // Route bare number keys (and `*` — common on barcode scanners) to the
      // hidden barcode input so a USB scanner works without manual focus.
      // Skip if the user is already typing in a text field, or if any
      // modifier (Ctrl/Cmd/Alt) is held — those are shortcuts like Ctrl+C.
      if (e.key.length === 1 && /[\d*]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement
        // Don't steal focus from text inputs — they're already in "typing" mode.
        const tag = active?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        h.onBarcodeKey()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
