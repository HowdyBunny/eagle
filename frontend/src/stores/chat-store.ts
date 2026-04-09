import { create } from 'zustand'
import type { ConversationLogResponse } from '@/types'
import * as conversationsApi from '@/lib/api/conversations'

interface ChatState {
  messages: ConversationLogResponse[]
  sending: boolean
  /** Partial text accumulated during streaming (empty when not streaming) */
  streamingContent: string
  /** Current tool label shown in the spinner (null when not executing a tool) */
  streamingStatus: string | null
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
  streamingContent: '',
  streamingStatus: null,
  error: null,
  _loadedProjectId: null,
  _sendingProjectId: null,

  loadHistory: async (projectId) => {
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
    set({
      messages: [...get().messages, optimisticMsg],
      sending: true,
      streamingContent: '',
      streamingStatus: null,
      _sendingProjectId: projectId,
      error: null,
    })

    try {
      const stream = conversationsApi.sendChatStream(projectId, message)

      for await (const event of stream) {
        // If the user switched project mid-stream, abort silently.
        if (get()._loadedProjectId !== projectId) {
          set({ sending: false, streamingContent: '', streamingStatus: null, _sendingProjectId: null })
          return
        }

        if (event.type === 'tool_call') {
          set({ streamingStatus: event.label, streamingContent: '' })
        }

        if (event.type === 'text') {
          set({ streamingStatus: null, streamingContent: get().streamingContent + event.delta })
        }

        if (event.type === 'done') {
          // reply_text can be empty if the LLM silently completed after a tool call.
          // Skip adding an invisible empty bubble in that case.
          const newMessages = event.reply_text
            ? [
                ...get().messages,
                {
                  id: event.conversation_id,
                  project_id: projectId,
                  role: 'assistant' as const,
                  content: event.reply_text,
                  intent_json: event.intent_json,
                  created_at: new Date().toISOString(),
                },
              ]
            : get().messages
          set({
            messages: newMessages,
            sending: false,
            streamingContent: '',
            streamingStatus: null,
            _sendingProjectId: null,
          })
          return
        }

        if (event.type === 'error') {
          set({ error: event.message, sending: false, streamingContent: '', streamingStatus: null, _sendingProjectId: null })
          return
        }
      }

      // Stream ended without a done event (shouldn't happen, handle gracefully)
      set({ sending: false, streamingContent: '', streamingStatus: null, _sendingProjectId: null })
    } catch (e) {
      set({ error: String(e), sending: false, streamingContent: '', streamingStatus: null, _sendingProjectId: null })
    }
  },

  clearMessages: () => set({ messages: [], streamingContent: '', streamingStatus: null }),
}))
