import { apiClient } from '../api-client'
import type { CandidateCreate, CandidateUpdate, CandidateResponse, CandidateSearchRequest, CandidateSearchResult } from '@/types'

export interface ListCandidatesParams {
  location?: string
  min_years?: number
  max_years?: number
  company?: string
  skip?: number
  limit?: number
}

export async function listCandidates(params: ListCandidatesParams = {}): Promise<CandidateResponse[]> {
  const { data } = await apiClient.get('/candidates', { params })
  return data
}

export async function addCandidate(body: CandidateCreate): Promise<CandidateResponse> {
  const { data } = await apiClient.post('/candidates', body)
  return data
}

export async function getCandidate(candidateId: string): Promise<CandidateResponse> {
  const { data } = await apiClient.get(`/candidates/${candidateId}`)
  return data
}

export async function updateCandidate(candidateId: string, body: CandidateUpdate): Promise<CandidateResponse> {
  const { data } = await apiClient.patch(`/candidates/${candidateId}`, body)
  return data
}

export async function deleteCandidate(candidateId: string): Promise<void> {
  await apiClient.delete(`/candidates/${candidateId}`)
}

export async function searchCandidates(body: CandidateSearchRequest): Promise<CandidateSearchResult[]> {
  const { data } = await apiClient.post('/candidates/search', body)
  return data
}
