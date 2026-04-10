import { apiClient } from '../api-client'
import type { ChatRequest, ChatResponse, ConversationLogResponse } from '@/types'

export async function sendChat(projectId: string, body: ChatRequest): Promise<ChatResponse> {
  const { data } = await apiClient.post(`/projects/${projectId}/chat`, body)
  return data
}

export async function getConversationHistory(
  projectId: string,
  skip = 0,
  limit = 100
): Promise<ConversationLogResponse[]> {
  const { data } = await apiClient.get(`/projects/${projectId}/conversations`, {
    params: { skip, limit },
  })
  return data
}

// ── SSE streaming chat ───────────────────────────────────────────────────────

export type StreamEvent =
  | { type: 'tool_call'; name: string; label: string }
  | { type: 'text'; delta: string }
  | { type: 'done'; reply_text: string; actions_taken: string[]; intent_json: Record<string, unknown> | null; conversation_id: string }
  | { type: 'error'; message: string }

/**
 * Calls POST /projects/{id}/chat/stream and yields parsed SSE events.
 * Uses native fetch so that ReadableStream is available (axios doesn't support it).
 */
export async function* sendChatStream(
  projectId: string,
  message: string,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`/api/projects/${projectId}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })

  if (!response.ok) {
    yield { type: 'error', message: `HTTP ${response.status}` }
    return
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE messages are separated by double newlines
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6)) as StreamEvent
        yield event
      } catch { /* skip malformed chunks */ }
    }
  }
}
