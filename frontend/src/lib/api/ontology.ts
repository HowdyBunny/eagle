import { apiClient } from '../api-client'
import type { OntologyResponse } from '@/types'

export async function listOntologies(params?: { industry?: string; skip?: number; limit?: number }): Promise<OntologyResponse[]> {
  const { data } = await apiClient.get('/ontology', { params })
  return data
}

export async function getOntology(ontologyId: string): Promise<OntologyResponse> {
  const { data } = await apiClient.get(`/ontology/${ontologyId}`)
  return data
}
