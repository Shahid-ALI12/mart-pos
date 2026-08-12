import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { invoke } from '@tauri-apps/api/core'
import { UserWithRole } from '../shared/types'

interface AuthState {
  user: UserWithRole | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  permissions: string[]
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  initializeAuth: () => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      permissions: [],

      login: async (username: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await invoke('login', { username, password }) as {
            user: UserWithRole
            token: string
            permissions: string[]
          }
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            permissions: response.permissions,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: async () => {
        // Stateless JWT: just tell the backend (no-op) and clear local state.
        try {
          await invoke('logout')
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            permissions: [],
          })
        }
      },

      initializeAuth: async () => {
        const { token } = get()
        if (!token) {
          // No token persisted → just mark loading done.
          set({ isLoading: false })
          return
        }

        set({ isLoading: true })
        try {
          // Pass the existing token to the backend; backend verifies signature + expiry
          // and returns a refreshed token + freshest user row.
          const response = await invoke('get_current_user', { token }) as {
            user: UserWithRole
            token: string
            permissions: string[]
          }
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            permissions: response.permissions,
            isLoading: false,
          })
        } catch (error) {
          // Token invalid / expired → clear local state, force re-login.
          console.warn('Session expired or invalid, clearing auth state:', error)
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            permissions: [],
            isLoading: false,
          })
        }
      },

      changePassword: async (oldPassword: string, newPassword: string) => {
        const { token } = get()
        if (!token) {
          throw new Error('Not authenticated')
        }
        await invoke('change_password', {
          token,
          oldPassword,
          newPassword,
        })
      },

      hasPermission: (permission: string) => {
        const { permissions } = get()
        return permissions.includes('*') || permissions.includes(permission)
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        permissions: state.permissions,
      }),
    }
  )
)
