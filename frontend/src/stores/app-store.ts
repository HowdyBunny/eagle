import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectResponse } from '@/types'

export type LLMProvider = 'openai' | 'anthropic'
export type WebSearchContextSize = 'low' | 'medium' | 'high'

export interface SettingsState {
  // LLM config
  llmProvider: LLMProvider
  llmApiKey: string
  llmModel: string
  llmBaseUrl: string
  webSearchContextSize: WebSearchContextSize
  // Backend auth
  authApiKey: string
  // Embedding config
  embeddingApiKey: string
  embeddingModel: string
  embeddingDimensions: number
  embeddingBaseUrl: string
}

interface AppState extends SettingsState {
  backendPort: number
  currentProjectId: string | null
  currentProject: ProjectResponse | null
  // setters
  setBackendPort: (port: number) => void
  updateSettings: (partial: Partial<SettingsState>) => void
  selectProject: (project: ProjectResponse) => void
  clearProject: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Defaults
      llmProvider: 'openai',
      llmApiKey: '',
      llmModel: 'gpt-4o',
      llmBaseUrl: '',
      webSearchContextSize: 'low',
      authApiKey: '',
      embeddingApiKey: '',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 1536,
      embeddingBaseUrl: '',
      backendPort: 8000,
      currentProjectId: null,
      currentProject: null,

      setBackendPort: (port) => set({ backendPort: port }),
      updateSettings: (partial) => set((s) => ({ ...s, ...partial })),
      selectProject: (project) =>
        set({ currentProjectId: project.id, currentProject: project }),
      clearProject: () => set({ currentProjectId: null, currentProject: null }),
    }),
    { name: 'eagle-app-store' }
  )
)
