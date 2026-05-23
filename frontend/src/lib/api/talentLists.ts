import { apiClient } from '../api-client'
import type {
  TalentListCreate,
  TalentListDetailResponse,
  TalentListMemberResponse,
  TalentListMemberUpdate,
  TalentListSummaryResponse,
  TalentListUpdate,
} from '@/types'

export interface ListTalentListsParams {
  project_id?: string
  unassigned?: boolean
}

export async function listTalentLists(
  params: ListTalentListsParams = {},
): Promise<TalentListSummaryResponse[]> {
  const { data } = await apiClient.get('/talent-lists', { params })
  return data
}

export async function getTalentList(listId: string): Promise<TalentListDetailResponse> {
  const { data } = await apiClient.get(`/talent-lists/${listId}`)
  return data
}

export async function createTalentList(
  body: TalentListCreate,
): Promise<TalentListDetailResponse> {
  const { data } = await apiClient.post('/talent-lists', body)
  return data
}

export async function updateTalentList(
  listId: string,
  body: TalentListUpdate,
): Promise<TalentListDetailResponse> {
  const { data } = await apiClient.patch(`/talent-lists/${listId}`, body)
  return data
}

export async function deleteTalentList(listId: string): Promise<void> {
  await apiClient.delete(`/talent-lists/${listId}`)
}

export async function addTalentListMembers(
  listId: string,
  candidateIds: string[],
): Promise<TalentListMemberResponse[]> {
  const { data } = await apiClient.post(`/talent-lists/${listId}/members`, {
    candidate_ids: candidateIds,
  })
  return data
}

export async function updateTalentListMember(
  listId: string,
  candidateId: string,
  body: TalentListMemberUpdate,
): Promise<TalentListMemberResponse> {
  const { data } = await apiClient.patch(
    `/talent-lists/${listId}/members/${candidateId}`,
    body,
  )
  return data
}

export async function removeTalentListMember(
  listId: string,
  candidateId: string,
): Promise<void> {
  await apiClient.delete(`/talent-lists/${listId}/members/${candidateId}`)
}

/**
 * Trigger an evaluation against a project AND mark the source list member
 * as added_to_project in one round-trip. The backend keeps the two updates
 * consistent.
 */
export async function promoteListMemberToProject(
  listId: string,
  candidateId: string,
  projectId: string,
): Promise<void> {
  await apiClient.post(
    `/projects/${projectId}/evaluate/${candidateId}`,
    undefined,
    { params: { source_list_id: listId } },
  )
}
