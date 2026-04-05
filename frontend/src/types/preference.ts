export interface PreferenceCreate {
  candidate_id?: string | null
  feedback_type: string
  hunter_comment: string
  weight_adjustment?: Record<string, number> | null
}

export interface PreferenceResponse {
  id: string
  project_id: string
  candidate_id: string | null
  feedback_type: string
  hunter_comment: string
  weight_adjustment: Record<string, number> | null
  created_at: string
}
