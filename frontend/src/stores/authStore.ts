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
          const response = await invoke('login', { username, password })
          // Backend returns { user, token, permissions }
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
        set({ isLoading: true })
        try {
          const response = await invoke('get_current_user')
          if (response.user) {
            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              permissions: response.permissions,
              isLoading: false,
            })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          set({ isLoading: false })
        }
      },

      changePassword: async (oldPassword: string, newPassword: string) => {
        await invoke('change_password', { oldPassword, newPassword })
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