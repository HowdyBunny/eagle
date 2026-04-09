import { create } from 'zustand'

interface UIState {
  isOnboardingOpen: boolean
  openOnboarding: () => void
  closeOnboarding: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isOnboardingOpen: false,
  openOnboarding: () => set({ isOnboardingOpen: true }),
  closeOnboarding: () => set({ isOnboardingOpen: false }),
}))
