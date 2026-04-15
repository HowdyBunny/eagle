import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectResponse } from '@/types'

export type LLMProvider = 'openai' | 'anthropic'
export type WebSearchStrategy = 'openai_responses' | 'anthropic_builtin' | 'extra_body' | 'openai_tool' | 'none'
export type WebSearchContextSize = 'low' | 'medium' | 'high'
export type VendorPresetId = 'openai' | 'anthropic' | 'qwen' | 'glm' | 'mimo' | 'custom'

export interface SettingsState {
  // LLM config
  vendorPreset: VendorPresetId
  llmProvider: LLMProvider
  llmApiKey: string
  llmModel: string
  llmBaseUrl: string
  webSearchStrategy: WebSearchStrategy
  webSearchExtraBody: string
  webSearchContextSize: WebSearchContextSize
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
      vendorPreset: 'openai' as VendorPresetId,
      llmProvider: 'openai',
      llmApiKey: '',
      llmModel: 'gpt-5.2',
      llmBaseUrl: 'https://api.openai.com/v1',
      webSearchStrategy: 'openai_responses' as WebSearchStrategy,
      webSearchExtraBody: '',
      webSearchContextSize: 'low',
      embeddingApiKey: '',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 1536,
      embeddingBaseUrl: '',
      backendPort: 52777,
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
