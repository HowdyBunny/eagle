import { apiClient } from '../api-client'

export interface RuntimeSettingsUpdate {
  llm_provider?: string
  llm_api_key?: string
  llm_model?: string
  llm_base_url?: string
  web_search_context_size?: string
  embedding_api_key?: string
  embedding_model?: string
  embedding_base_url?: string
  embedding_dimensions?: number
}

export async function updateRuntimeSettings(
  body: RuntimeSettingsUpdate
): Promise<{ status: string }> {
  const { data } = await apiClient.put('/settings', body)
  return data
}
