import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import OnboardingModal from '@/components/shared/OnboardingModal'
import { useAppStore } from '@/stores/app-store'
import { useUIStore } from '@/stores/ui-store'
import { getRuntimeSettings } from '@/lib/api/settings'

// ── Backend readiness constants ───────────────────────────────────────────────

const HEALTH_URL = 'http://127.0.0.1:52777/api/health'
const POLL_INTERVAL_MS = 800
// After this deadline we show the app anyway and let individual pages handle errors.
const MAX_WAIT_MS = 40_000

// ── Loading screen shown while the sidecar boots ──────────────────────────────

function BackendStartingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl kinetic-gradient flex items-center justify-center shadow-xl">
          <span className="text-white font-headline font-black text-2xl">E</span>
        </div>
        <div className="text-center">
          <h1 className="font-headline font-black text-lg text-on-surface mb-1.5">Eagle</h1>
          <p className="text-sm text-secondary">后端服务启动中，请稍候…</p>
        </div>
        {/* Bouncing dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Poll the health endpoint once, returning true if ok ───────────────────────

async function pingHealth(): Promise<boolean> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 2500)
  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal })
    clearTimeout(tid)
    return res.ok
  } catch {
    clearTimeout(tid)
    return false
  }
}

// ── Main shell ────────────────────────────────────────────────────────────────

export default function AppShell() {
  const { pathname } = useLocation()
  const { llmApiKey, embeddingApiKey, updateSettings } = useAppStore()
  const { openOnboarding } = useUIStore()
  const [backendReady, setBackendReady] = useState(false)

  // Poll /api/health until the sidecar (or dev server) is accepting requests.
  // In web-dev mode this resolves on the first attempt (<1 ms).
  // In the packaged Tauri app the PyInstaller sidecar typically needs 2-8 s.
  useEffect(() => {
    let cancelled = false
    const deadline = Date.now() + MAX_WAIT_MS

    const poll = async () => {
      while (!cancelled) {
        const ok = await pingHealth()
        if (ok) {
          if (cancelled) return
          // Sync non-secret fields from the backend (.env) into the frontend
          // store so that Settings UI always reflects what the backend actually uses.
          // API keys are excluded from GET /settings for security and remain
          // as stored in localStorage.
          try {
            const s = await getRuntimeSettings()
            updateSettings({
              llmProvider: s.llm_provider as 'openai' | 'anthropic',
              llmModel: s.llm_model,
              llmBaseUrl: s.llm_base_url ?? '',
              webSearchStrategy: s.web_search_strategy as import('@/stores/app-store').WebSearchStrategy,
              webSearchExtraBody: s.web_search_extra_body ?? '',
              webSearchContextSize: s.web_search_context_size as 'low' | 'medium' | 'high',
              embeddingModel: s.embedding_model,
              embeddingBaseUrl: s.embedding_base_url ?? '',
              embeddingDimensions: s.embedding_dimensions,
            })
          } catch {
            // Non-fatal: fall back to whatever is in localStorage.
          }
          setBackendReady(true)
          return
        }
        if (Date.now() >= deadline) {
          // Timed out — show the app so the user isn't stuck forever.
          if (!cancelled) setBackendReady(true)
          return
        }
        // Wait before next attempt (skip if cancelled during await)
        await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS))
      }
    }

    poll()
    return () => { cancelled = true }
  }, [])

  // Show onboarding once on startup if either API key is missing.
  // This effect fires on mount but OnboardingModal only renders after
  // backendReady is true, so the modal appears at the right time.
  useEffect(() => {
    if (!llmApiKey || !embeddingApiKey) {
      openOnboarding()
    }
    // Intentionally run only once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!backendReady) return <BackendStartingScreen />

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
