// modules/pos/components/index.ts
// Barrel export for POS sub-components so the main POS.tsx can import
// everything from a single line: `import { ProductSearch, CartList, ... } from './components'`

export { ProductSearch } from './ProductSearch'
export { CartList } from './CartList'
export { CartSummary } from './CartSummary'
export { PaymentSidebar } from './PaymentSidebar'
export { PaymentModal } from './PaymentModal'
export { CustomerModal } from './CustomerModal'
export { HoldBillModal } from './HoldBillModal'
