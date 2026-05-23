import type { CandidateResponse } from './candidate'
import type { ProjectCandidateResponse } from './evaluation'

export type TalentListSource = 'manual' | 'ca_conversation'

export type TalentListMemberStatus =
  | 'not_contacted'
  | 'contacted'
  | 'scheduled'
  | 'declined'
  | 'added_to_project'

/**
 * Filters payload saved alongside a list. Mirrors a subset of
 * CandidateSearchRequest so the list can be "re-run" later. We store this as
 * an opaque dict server-side; the frontend interprets it.
 */
export interface TalentListFiltersJson {
  query?: string | null
  location?: string | null
  min_years_experience?: number | null
  max_years_experience?: number | null
  current_company?: string | null
  schools?: string[] | null
  exclude_companies?: string[] | null
  exclude_locations?: string[] | null
  exclude_query?: string | null
  // Free-form: anything we want to remember about the search context.
  [key: string]: unknown
}

export interface TalentListSummaryResponse {
  id: string
  name: string
  project_id: string | null
  project_name: string | null
  client_name: string | null
  filters_json: TalentListFiltersJson | null
  source: TalentListSource
  member_count: number
  status_counts: Partial<Record<TalentListMemberStatus, number>>
  created_at: string
  updated_at: string
}

export interface TalentListMemberResponse {
  id: string
  list_id: string
  candidate_id: string
  status: TalentListMemberStatus
  hunter_note: string | null
  added_at: string
  updated_at: string
  candidate: CandidateResponse | null
  /**
   * Project-level evaluation joined in by the backend when the parent list is
   * bound to a project. Null when the list is unassigned, or when this member
   * has not been promoted to project evaluation yet.
   *
   * Once present, the recruiter UI uses this to:
   * - Render the "评估中 / 已评估 N 分 / 评估失败" variants of the 已推进 badge
   * - Open the EvaluationReportDrawer to view match_score, recommendation, etc.
   * - Edit project_candidates.status (recommended / interviewed / eliminated)
   */
  project_evaluation: ProjectCandidateResponse | null
}

export interface TalentListDetailResponse extends TalentListSummaryResponse {
  members: TalentListMemberResponse[]
}

export interface TalentListCreate {
  name: string
  project_id?: string | null
  filters_json?: TalentListFiltersJson | null
  source?: TalentListSource
  candidate_ids?: string[]
}

export interface TalentListUpdate {
  name?: string
  project_id?: string | null
  filters_json?: TalentListFiltersJson | null
}

export interface TalentListMemberUpdate {
  status?: TalentListMemberStatus
  hunter_note?: string | null
}
