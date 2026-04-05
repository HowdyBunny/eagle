import { create } from 'zustand'
import type { ConversationLogResponse } from '@/types'
import * as conversationsApi from '@/lib/api/conversations'

interface ChatState {
  messages: ConversationLogResponse[]
  sending: boolean
  error: string | null
  loadHistory: (projectId: string) => Promise<void>
  sendMessage: (projectId: string, message: string) => Promise<void>
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sending: false,
  error: null,

  loadHistory: async (projectId) => {
    // Reset immediately so stale messages don't flash when switching projects.
    set({ messages: [], error: null })
    try {
      const messages = await conversationsApi.getConversationHistory(projectId)
      set({ messages })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  sendMessage: async (projectId, message) => {
    // Optimistically add user message
    const optimisticMsg: ConversationLogResponse = {
      id: `optimistic-${Date.now()}`,
      project_id: projectId,
      role: 'hunter',
      content: message,
      intent_json: null,
      created_at: new Date().toISOString(),
    }
    set({ messages: [...get().messages, optimisticMsg], sending: true, error: null })

    try {
      const response = await conversationsApi.sendChat(projectId, { message })
      const assistantMsg: ConversationLogResponse = {
        id: `assistant-${Date.now()}`,
        project_id: projectId,
        role: 'assistant',
        content: response.reply,
        intent_json: response.intent_json,
        created_at: new Date().toISOString(),
      }
      set({ messages: [...get().messages, assistantMsg], sending: false })
    } catch (e) {
      set({ error: String(e), sending: false })
    }
  },

  clearMessages: () => set({ messages: [] }),
}))
