import { apiClient } from '../api-client'

export async function checkHealth(): Promise<{ status: string; service: string }> {
  const { data } = await apiClient.get('/health')
  return data
}
