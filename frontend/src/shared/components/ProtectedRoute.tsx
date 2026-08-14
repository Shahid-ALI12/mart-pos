// shared/components/ProtectedRoute.tsx
//
// Wraps protected sections of the app. If the user is not authenticated
// (per the zustand auth store), they are redirected to /login.
//
// Why a wrapper instead of a <Route guard>? react-router v6 dropped
// built-in route guards in favour of wrapper components — this is the
// canonical pattern from the v6 docs.

import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Children are already rendered by the parent <Route element={...}>,
  // so we just return them — no need for <Outlet/> here.
  return <>{children}</>
}
