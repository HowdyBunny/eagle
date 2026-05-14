import { create } from 'zustand'
import type { ConversationLogResponse, ThreadResponse } from '@/types'
import * as conversationsApi from '@/lib/api/conversations'
import * as threadsApi from '@/lib/api/threads'

interface ChatState {
  messages: ConversationLogResponse[]
  sending: boolean
  streamingContent: string
  streamingStatus: string | null
  error: string | null
  failedMessage: { id: string; content: string } | null
  _loadedProjectId: string | null
  _sendingProjectId: string | null

  // Thread state
  threads: ThreadResponse[]
  currentThreadId: string | null
  threadsLoading: boolean

  loadHistory: (projectId: string, threadId?: string | null) => Promise<void>
  sendMessage: (projectId: string, message: string) => Promise<void>
  retryMessage: (projectId: string) => Promise<void>
  clearMessages: () => void

  loadThreads: (projectId: string) => Promise<void>
  createThread: (projectId: string, name?: string) => Promise<ThreadResponse>
  switchThread: (projectId: string, threadId: string | null) => Promise<void>
  renameThread: (projectId: string, threadId: string, name: string) => Promise<void>
  deleteThread: (projectId: string, threadId: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sending: false,
  streamingContent: '',
  streamingStatus: null,
  error: null,
  failedMessage: null,
  _loadedProjectId: null,
  _sendingProjectId: null,

  threads: [],
  currentThreadId: null,
  threadsLoading: false,

  loadHistory: async (projectId, threadId) => {
    const tid = threadId !== undefined ? threadId : get().currentThreadId
    const key = `${projectId}::${tid ?? 'none'}`
    if (get()._loadedProjectId !== key) {
      set({ messages: [], error: null })
    }
    set({ _loadedProjectId: key })
    try {
      const messages = await conversationsApi.getConversationHistory(projectId, tid)
      set({ messages })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  retryMessage: async (projectId) => {
    const { failedMessage } = get()
    if (!failedMessage) return
    const content = failedMessage.content
    set({ messages: get().messages.filter((m) => m.id !== failedMessage.id), failedMessage: null, error: null })
    await get().sendMessage(projectId, content)
  },

  sendMessage: async (projectId, message) => {
    const { failedMessage, currentThreadId } = get()
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg: ConversationLogResponse = {
      id: optimisticId,
      project_id: projectId,
      thread_id: currentThreadId,
      role: 'hunter',
      content: message,
      intent_json: null,
      created_at: new Date().toISOString(),
    }
    const prevMessages = failedMessage
      ? get().messages.filter((m) => m.id !== failedMessage.id)
      : get().messages
    const loadKey = `${projectId}::${currentThreadId ?? 'none'}`
    set({
      messages: [...prevMessages, optimisticMsg],
      sending: true,
      streamingContent: '',
      streamingStatus: null,
      _sendingProjectId: projectId,
      failedMessage: null,
      error: null,
    })

    try {
      const stream = conversationsApi.sendChatStream(projectId, message, currentThreadId)

      for await (const event of stream) {
        if (get()._loadedProjectId !== loadKey) {
          set({ sending: false, streamingContent: '', streamingStatus: null, _sendingProjectId: null })
          return
        }

        if (event.type === 'tool_call') set({ streamingStatus: event.label, streamingContent: '' })
        if (event.type === 'text') set({ streamingStatus: null, streamingContent: get().streamingContent + event.delta })

        if (event.type === 'done') {
          const newMessages = event.reply_text
            ? [...get().messages, {
                id: event.conversation_id,
                project_id: projectId,
                thread_id: currentThreadId,
                role: 'assistant' as const,
                content: event.reply_text,
                intent_json: event.intent_json,
                created_at: new Date().toISOString(),
              }]
            : get().messages
          set({ messages: newMessages, sending: false, streamingContent: '', streamingStatus: null, _sendingProjectId: null })
          return
        }

        if (event.type === 'error') {
          set({ error: event.message, sending: false, streamingContent: '', streamingStatus: null, _sendingProjectId: null, failedMessage: { id: optimisticId, content: message } })
          return
        }
      }

      set({ sending: false, streamingContent: '', streamingStatus: null, _sendingProjectId: null })
    } catch (e) {
      set({ error: String(e), sending: false, streamingContent: '', streamingStatus: null, _sendingProjectId: null, failedMessage: { id: optimisticId, content: message } })
    }
  },

  clearMessages: () => set({ messages: [], streamingContent: '', streamingStatus: null, failedMessage: null, error: null }),

  // ── Thread actions ──────────────────────────────────────────────────────────

  loadThreads: async (projectId) => {
    // Reset thread + message state immediately so stale content from a previous
    // project never leaks through while the new project's threads are loading.
    set({ threads: [], threadsLoading: true, currentThreadId: null, messages: [], error: null, failedMessage: null })
    try {
      const threads = await threadsApi.listThreads(projectId)
      // Auto-select the most recently created real thread (first in desc list).
      // If there are only legacy null-thread messages, keep currentThreadId = null.
      const firstReal = threads.find((t) => !t.is_legacy && t.id !== null)
      const nextThreadId = firstReal?.id ?? null
      set({ threads, threadsLoading: false, currentThreadId: nextThreadId })
      await get().loadHistory(projectId, nextThreadId)
    } catch {
      set({ threadsLoading: false })
    }
  },

  createThread: async (projectId, name = '新对话') => {
    const thread = await threadsApi.createThread(projectId, { name })
    set((s) => ({ threads: [thread, ...s.threads] }))
    return thread
  },

  switchThread: async (projectId, threadId) => {
    set({ currentThreadId: threadId, messages: [], error: null, failedMessage: null })
    await get().loadHistory(projectId, threadId)
  },

  renameThread: async (projectId, threadId, name) => {
    const updated = await threadsApi.renameThread(projectId, threadId, name)
    set((s) => ({ threads: s.threads.map((t) => (t.id === threadId ? updated : t)) }))
  },

  deleteThread: async (projectId, threadId) => {
    await threadsApi.deleteThread(projectId, threadId)
    const { currentThreadId, threads } = get()
    const remaining = threads.filter((t) => t.id !== threadId)
    // If we deleted the current thread, fall back to the next available or null
    const fallback = currentThreadId === threadId ? (remaining[0]?.id ?? null) : currentThreadId
    set({ threads: remaining, currentThreadId: fallback })
    if (currentThreadId === threadId) {
      await get().loadHistory(projectId, fallback)
    }
  },
}))
