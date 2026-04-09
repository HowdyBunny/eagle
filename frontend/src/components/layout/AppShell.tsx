import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import OnboardingModal from '@/components/shared/OnboardingModal'
import { useAppStore } from '@/stores/app-store'
import { useUIStore } from '@/stores/ui-store'

export default function AppShell() {
  const { pathname } = useLocation()
  const { llmApiKey, embeddingApiKey } = useAppStore()
  const { openOnboarding } = useUIStore()

  // Show onboarding on startup if either key is missing
  useEffect(() => {
    if (!llmApiKey || !embeddingApiKey) {
      openOnboarding()
    }
  // Only run once on mount — intentionally omit changing deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-screen w-full bg-surface text-on-surface font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 bg-surface relative">
        <TopBar />
        <div className="flex-1 overflow-y-auto relative [scrollbar-gutter:stable]">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="min-h-full flex flex-col"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Onboarding modal — rendered above everything */}
      <OnboardingModal />
    </div>
  )
}
