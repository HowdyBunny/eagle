import { create } from 'zustand'
import type { ResearchResponse } from '@/types'
import * as researchApi from '@/lib/api/research'

let researchPollInterval: ReturnType<typeof setInterval> | null = null

const MAX_RESEARCH_POLL = 18 // 3 minutes at 10s interval

interface ResearchState {
  records: ResearchResponse[]
  selectedRecordId: string | null
  loading: boolean
  isResearching: boolean
  researchError: string | null
  error: string | null
  fetchRecords: (projectId: string) => Promise<void>
  triggerResearch: (projectId: string, topic: string, additionalContext?: string) => Promise<void>
  retryResearch: (projectId: string, topic: string, additionalContext?: string) => Promise<void>
  selectRecord: (id: string) => void
  stopPolling: () => void
}

export const useResearchStore = create<ResearchState>((set, get) => ({
  records: [],
  selectedRecordId: null,
  loading: false,
  isResearching: false,
  researchError: null,
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
    set({ isResearching: true, researchError: null })

    get().stopPolling()
    let pollCount = 0
    researchPollInterval = setInterval(async () => {
      pollCount++
      if (pollCount > MAX_RESEARCH_POLL) {
        get().stopPolling()
        set({ isResearching: false, researchError: '任务超时，请重试' })
        return
      }
      try {
        const records = await researchApi.listResearch(projectId)
        if (records.length > prevCount) {
          get().stopPolling()
          set({ records, isResearching: false, researchError: null })
        }
      } catch {
        // keep polling on transient errors
      }
    }, 10_000)
  },

  retryResearch: async (projectId, topic, additionalContext) => {
    set({ researchError: null })
    await get().triggerResearch(projectId, topic, additionalContext)
  },

  selectRecord: (id) => set({ selectedRecordId: id }),

  stopPolling: () => {
    if (researchPollInterval) {
      clearInterval(researchPollInterval)
      researchPollInterval = null
    }
  },
}))
