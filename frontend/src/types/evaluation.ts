import type { CandidateResponse } from './candidate'

export type ProjectCandidateStatus = 'pending' | 'recommended' | 'eliminated' | 'interviewed'

export interface ProjectCandidateResponse {
  id: string
  project_id: string
  candidate_id: string
  match_score: number | null
  dimension_scores: Record<string, number> | null
  recommendation: string | null
  risk_flags: string | null
  hunter_feedback: string | null
  status: ProjectCandidateStatus
  evaluated_at: string | null
  trigger_source: string | null
  llm_raw_output: string | null
  candidate: CandidateResponse | null
}

export interface CandidateEvaluationResponse {
  id: string
  project_id: string
  project_name: string
  client_name: string
  match_score: number | null
  recommendation: string | null
  risk_flags: string | null
  trigger_source: string | null
  status: ProjectCandidateStatus
  evaluated_at: string | null
}

export interface ProjectCandidateUpdate {
  status?: ProjectCandidateStatus | null
  hunter_feedback?: string | null
}

export interface EvaluationStatusResponse {
  project_id: string
  candidate_id: string
  is_complete: boolean
  status: ProjectCandidateStatus
  match_score: number | null
  evaluated_at: string | null
  poll_interval_seconds: number
}
