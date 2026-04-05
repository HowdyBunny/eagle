export type ConversationRole = 'hunter' | 'assistant'

export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  reply: string
  intent_json: Record<string, unknown> | null
  actions_taken: string[]
}

export interface ConversationLogResponse {
  id: string
  project_id: string
  role: ConversationRole
  content: string
  intent_json: Record<string, unknown> | null
  created_at: string
}
