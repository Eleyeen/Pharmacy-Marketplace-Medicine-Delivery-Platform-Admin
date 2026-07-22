import { create } from 'zustand'
import type { AdminUser } from '../types'

interface AuthState {
  accessToken: string | null
  admin: AdminUser | null
  hydrated: boolean
  setSession: (accessToken: string, admin: AdminUser) => void
  clearSession: () => void
  setHydrated: (hydrated: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  admin: null,
  hydrated: false,
  setSession: (accessToken, admin) => set({ accessToken, admin, hydrated: true }),
  clearSession: () => set({ accessToken: null, admin: null, hydrated: true }),
  setHydrated: (hydrated) => set({ hydrated }),
}))
