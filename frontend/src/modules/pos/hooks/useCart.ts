// modules/pos/hooks/useCart.ts
//
// Cart state + derived totals for the POS screen.
//
// This hook owns the cart array and exposes:
//   - mutation helpers (add / updateQty / remove / clear / setCart)
//   - derived totals (subtotal, totalDiscount, totalGST, grandTotal, roundedTotal)
//
// The GST split logic (CGST + SGST = half each of GST, IGST = 0 for now) is
// centralized here so that every component that touches the cart sees the
// same numbers — the payment sidebar, the cart summary footer, and the
// payment confirmation modal all read from this hook's return value.
//
// `addToCart` is wrapped in useCallback so it can be passed down to the
// product-search dropdown and the barcode scanner without re-creating the
// function on every render (which would invalidate memoization downstream).

import { useState, useCallback, useMemo } from 'react'
import type { ProductWithDetails, ProductVariant, CartItem } from '../../../shared/types'
import { generateId } from '../../../shared/utils'

export interface UseCartResult {
  cart: CartItem[]
  subtotal: number
  totalDiscount: number
  totalGST: number
  grandTotal: number
  roundedTotal: number
  totalQty: number
  addToCart: (product: ProductWithDetails, variant?: ProductVariant) => void
  updateQty: (id: string, delta: number) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  setCart: (cart: CartItem[]) => void
}

/**
 * GST split helper — splits `unit_price * gst_rate` into CGST + SGST halves.
 * IGST is currently always 0 (intra-state sales). When inter-state sales
 * land, swap to IGST-only here and the rest of the cart math follows.
 */
function splitGst(unitPrice: number, gstRate: number, qty: number) {
  const gstPerUnit = (unitPrice * gstRate) / 100
  const cgst = (gstPerUnit / 2) * qty
  const sgst = (gstPerUnit / 2) * qty
  return { cgst, sgst, igst: 0 }
}

export function useCart(): UseCartResult {
  const [cart, setCartState] = useState<CartItem[]>([])

  const addToCart = useCallback((product: ProductWithDetails, variant?: ProductVariant) => {
    setCartState(prev => {
      const existingIndex = prev.findIndex(item =>
        item.product_id === product.id &&
        item.variant_id === variant?.id &&
        item.unit_id === product.unit_id
      )

      const basePrice = variant?.sale_price || product.sale_price
      const gstRate = product.gst_rate

      if (existingIndex >= 0) {
        const updated = [...prev]
        const existing = updated[existingIndex]
        const newQty = existing.qty + 1
        const { cgst, sgst } = splitGst(existing.unit_price, gstRate, newQty)
        updated[existingIndex] = {
          ...existing,
          qty: newQty,
          line_total: existing.unit_price * newQty,
          cgst_amount: cgst,
          sgst_amount: sgst,
        }
        return updated
      }

      const { cgst, sgst } = splitGst(basePrice, gstRate, 1)
      const newItem: CartItem = {
        id: generateId(),
        product_id: product.id,
        variant_id: variant?.id,
        product,
        variant,
        unit_id: product.unit_id,
        qty: 1,
        free_qty: 0,
        unit_price: basePrice,
        discount_percent: 0,
        discount_amount: 0,
        gst_rate: gstRate,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: 0,
        line_total: basePrice,
        cost_price: product.purchase_price,
      }
      return [...prev, newItem]
    })
  }, [])

  const updateQty = useCallback((id: string, delta: number) => {
    setCartState(prev => prev.map(item => {
      if (item.id !== id) return item
      const newQty = Math.max(1, item.qty + delta)
      const { cgst, sgst } = splitGst(item.unit_price, item.gst_rate, newQty)
      return {
        ...item,
        qty: newQty,
        line_total: item.unit_price * newQty,
        cgst_amount: cgst,
        sgst_amount: sgst,
      }
    }))
  }, [])

  const removeFromCart = useCallback((id: string) => {
    setCartState(prev => prev.filter(item => item.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setCartState([])
  }, [])

  const setCart = useCallback((newCart: CartItem[]) => {
    setCartState(newCart)
  }, [])

  // Derived totals — recomputed whenever cart changes. Cheap (cart rarely > 50 items).
  const { subtotal, totalDiscount, totalGST, grandTotal, roundedTotal, totalQty } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + item.line_total, 0)
    const disc = cart.reduce((sum, item) => sum + item.discount_amount, 0)
    const gst = cart.reduce((sum, item) => sum + item.cgst_amount + item.sgst_amount + item.igst_amount, 0)
    const gt = sub - disc + gst
    const qty = cart.reduce((sum, item) => sum + item.qty, 0)
    return {
      subtotal: sub,
      totalDiscount: disc,
      totalGST: gst,
      grandTotal: gt,
      roundedTotal: Math.round(gt * 100) / 100,
      totalQty: qty,
    }
  }, [cart])

  return {
    cart,
    subtotal,
    totalDiscount,
    totalGST,
    grandTotal,
    roundedTotal,
    totalQty,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    setCart,
  }
}
