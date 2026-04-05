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
