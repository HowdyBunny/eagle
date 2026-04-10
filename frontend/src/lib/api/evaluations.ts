import { apiClient } from '../api-client'
import type { ProjectCandidateResponse, ProjectCandidateUpdate, EvaluationStatusResponse, CandidateEvaluationResponse } from '@/types'

export async function triggerEvaluation(
  projectId: string,
  candidateId: string
): Promise<{ message: string; project_id: string; candidate_id: string; status_url: string; poll_interval_seconds: number }> {
  const { data } = await apiClient.post(`/projects/${projectId}/evaluate/${candidateId}`)
  return data
}

export async function pollEvaluationStatus(
  projectId: string,
  candidateId: string
): Promise<EvaluationStatusResponse> {
  const { data } = await apiClient.get(`/projects/${projectId}/candidates/${candidateId}/status`)
  return data
}

export async function listProjectCandidates(
  projectId: string,
  sortByScore = true
): Promise<ProjectCandidateResponse[]> {
  const { data } = await apiClient.get(`/projects/${projectId}/candidates`, {
    params: { sort_by_score: sortByScore },
  })
  return data
}

export async function listCandidateEvaluations(
  candidateId: string
): Promise<CandidateEvaluationResponse[]> {
  const { data } = await apiClient.get(`/candidates/${candidateId}/evaluations`)
  return data
}

export async function updateProjectCandidate(
  projectId: string,
  candidateId: string,
  body: ProjectCandidateUpdate
): Promise<ProjectCandidateResponse> {
  const { data } = await apiClient.patch(`/projects/${projectId}/candidates/${candidateId}`, body)
  return data
}
