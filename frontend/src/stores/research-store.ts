import { create } from 'zustand'
import type { ResearchResponse } from '@/types'
import * as researchApi from '@/lib/api/research'

interface ResearchState {
  records: ResearchResponse[]
  selectedRecordId: string | null
  loading: boolean
  error: string | null
  fetchRecords: (projectId: string) => Promise<void>
  triggerResearch: (projectId: string, topic: string, additionalContext?: string) => Promise<void>
  selectRecord: (id: string) => void
}

export const useResearchStore = create<ResearchState>((set, get) => ({
  records: [],
  selectedRecordId: null,
  loading: false,
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
    await researchApi.triggerResearch(projectId, { topic, additional_context: additionalContext })
    // Refresh records after triggering
    await get().fetchRecords(projectId)
  },

  selectRecord: (id) => set({ selectedRecordId: id }),
}))
