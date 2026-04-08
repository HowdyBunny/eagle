import { create } from 'zustand'
import type { ConversationLogResponse } from '@/types'
import * as conversationsApi from '@/lib/api/conversations'

interface ChatState {
  messages: ConversationLogResponse[]
  sending: boolean
  error: string | null
  _loadedProjectId: string | null
  _sendingProjectId: string | null
  loadHistory: (projectId: string) => Promise<void>
  sendMessage: (projectId: string, message: string) => Promise<void>
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sending: false,
  error: null,
  _loadedProjectId: null,
  _sendingProjectId: null,

  loadHistory: async (projectId) => {
    // Only clear messages when switching to a different project.
    // Returning to the same project keeps existing messages visible during reload.
    if (get()._loadedProjectId !== projectId) {
      set({ messages: [], error: null })
    }
    set({ _loadedProjectId: projectId })
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
    set({ messages: [...get().messages, optimisticMsg], sending: true, _sendingProjectId: projectId, error: null })

    try {
      const response = await conversationsApi.sendChat(projectId, { message })
      // If the user switched to a different project while waiting, don't corrupt
      // the new project's message list. The reply is already saved on the backend.
      if (get()._loadedProjectId !== projectId) {
        set({ sending: false, _sendingProjectId: null })
        return
      }
      const assistantMsg: ConversationLogResponse = {
        id: `assistant-${Date.now()}`,
        project_id: projectId,
        role: 'assistant',
        content: response.reply,
        intent_json: response.intent_json,
        created_at: new Date().toISOString(),
      }
      set({ messages: [...get().messages, assistantMsg], sending: false, _sendingProjectId: null })
    } catch (e) {
      set({ error: String(e), sending: false, _sendingProjectId: null })
    }
  },

  clearMessages: () => set({ messages: [] }),
}))
