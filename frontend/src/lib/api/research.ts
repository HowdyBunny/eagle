import { apiClient } from '../api-client'
import type { ResearchTriggerRequest, ResearchResponse } from '@/types'

export async function triggerResearch(
  projectId: string,
  body: ResearchTriggerRequest
): Promise<{ message: string; project_id: string; topic: string }> {
  const { data } = await apiClient.post(`/projects/${projectId}/research`, body)
  return data
}

export async function listResearch(projectId: string): Promise<ResearchResponse[]> {
  const { data } = await apiClient.get(`/projects/${projectId}/research`)
  return data
}
