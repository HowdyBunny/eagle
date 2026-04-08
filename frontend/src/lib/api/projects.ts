import { apiClient } from '../api-client'
import type { ProjectCreate, ProjectUpdate, ProjectResponse } from '@/types'

export async function listProjects(skip = 0, limit = 50): Promise<ProjectResponse[]> {
  const { data } = await apiClient.get('/projects', { params: { skip, limit } })
  return data
}

export async function createProject(body: ProjectCreate): Promise<ProjectResponse> {
  const { data } = await apiClient.post('/projects', body)
  return data
}

export async function getProject(projectId: string): Promise<ProjectResponse> {
  const { data } = await apiClient.get(`/projects/${projectId}`)
  return data
}

export async function updateProject(projectId: string, body: ProjectUpdate): Promise<ProjectResponse> {
  const { data } = await apiClient.patch(`/projects/${projectId}`, body)
  return data
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}`)
}
