import { apiClient } from '../api-client'
import type { CandidateCreate, CandidateResponse, CandidateSearchRequest, CandidateSearchResult } from '@/types'

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

export async function searchCandidates(body: CandidateSearchRequest): Promise<CandidateSearchResult[]> {
  const { data } = await apiClient.post('/candidates/search', body)
  return data
}
