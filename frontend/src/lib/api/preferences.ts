import { apiClient } from '../api-client'
import type { PreferenceCreate, PreferenceResponse } from '@/types'

export async function createPreference(projectId: string, body: PreferenceCreate): Promise<PreferenceResponse> {
  const { data } = await apiClient.post(`/projects/${projectId}/preferences`, body)
  return data
}

export async function listPreferences(projectId: string): Promise<PreferenceResponse[]> {
  const { data } = await apiClient.get(`/projects/${projectId}/preferences`)
  return data
}
