import { apiClient } from '../api-client'
import type { ThreadCreate, ThreadRename, ThreadResponse } from '@/types'

export async function createThread(projectId: string, body: ThreadCreate = {}): Promise<ThreadResponse> {
  const { data } = await apiClient.post(`/projects/${projectId}/threads`, { name: body.name ?? '新对话' })
  return data
}

export async function listThreads(projectId: string): Promise<ThreadResponse[]> {
  const { data } = await apiClient.get(`/projects/${projectId}/threads`)
  return data
}

export async function renameThread(projectId: string, threadId: string, name: string): Promise<ThreadResponse> {
  const { data } = await apiClient.patch(`/projects/${projectId}/threads/${threadId}`, { name } satisfies ThreadRename)
  return data
}

export async function deleteThread(projectId: string, threadId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/threads/${threadId}`)
}
