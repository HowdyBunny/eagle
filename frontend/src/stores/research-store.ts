import { create } from 'zustand'
import type { ResearchResponse } from '@/types'
import * as researchApi from '@/lib/api/research'

let researchPollInterval: ReturnType<typeof setInterval> | null = null

interface ResearchState {
  records: ResearchResponse[]
  selectedRecordId: string | null
  loading: boolean
  isResearching: boolean
  error: string | null
  fetchRecords: (projectId: string) => Promise<void>
  triggerResearch: (projectId: string, topic: string, additionalContext?: string) => Promise<void>
  selectRecord: (id: string) => void
  stopPolling: () => void
}

export const useResearchStore = create<ResearchState>((set, get) => ({
  records: [],
  selectedRecordId: null,
  loading: false,
  isResearching: false,
  error: null,

  fetchRecords: async (projectId) => {
    set({ loading: true, error: null })
    try {
      const records = await researchApi.listResearch(projectId)
      set({ records, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  triggerResearch: async (projectId, topic, additionalContext) => {
    const prevCount = get().records.length
    await researchApi.triggerResearch(projectId, { topic, additional_context: additionalContext })
    set({ isResearching: true })

    // Poll every 10s until a new record appears
    get().stopPolling()
    researchPollInterval = setInterval(async () => {
      try {
        const records = await researchApi.listResearch(projectId)
        if (records.length > prevCount) {
          get().stopPolling()
          set({ records, isResearching: false })
        }
      } catch {
        // keep polling on transient errors
      }
    }, 10_000)
  },

  selectRecord: (id) => set({ selectedRecordId: id }),

  stopPolling: () => {
    if (researchPollInterval) {
      clearInterval(researchPollInterval)
      researchPollInterval = null
    }
  },
}))
