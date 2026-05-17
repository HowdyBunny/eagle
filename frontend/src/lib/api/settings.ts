import { apiClient } from '../api-client'

export interface RuntimeSettingsUpdate {
  llm_provider?: string
  llm_api_key?: string
  llm_model?: string
  llm_base_url?: string
  tavily_api_key?: string
  embedding_api_key?: string
  embedding_model?: string
  embedding_base_url?: string
  embedding_dimensions?: number
}

// API keys are intentionally excluded from the response for security.
// `tavily_configured` indicates whether a non-empty TAVILY_API_KEY is set
// on the backend, without exposing the key itself.
export interface RuntimeSettingsResponse {
  llm_provider: string
  llm_model: string
  llm_base_url: string | null
  tavily_configured: boolean
  embedding_model: string
  embedding_base_url: string | null
  embedding_dimensions: number
}

export async function getRuntimeSettings(): Promise<RuntimeSettingsResponse> {
  const { data } = await apiClient.get('/settings')
  return data
}

export async function updateRuntimeSettings(
  body: RuntimeSettingsUpdate
): Promise<{ status: string }> {
  const { data } = await apiClient.put('/settings', body)
  return data
}
