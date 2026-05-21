export interface CandidateCreate {
  full_name: string
  current_title?: string | null
  current_company?: string | null
  location?: string | null
  years_experience?: number | null
  salary_range?: string | null
  education?: string | null
  linkedin_url?: string | null
  liepin_url?: string | null
  phone?: string | null
  email?: string | null
  raw_structured_data?: Record<string, unknown> | null
  experience_summary?: string | null
  source_platform?: string | null
}

export interface CandidateResponse {
  id: string
  full_name: string
  current_title: string | null
  current_company: string | null
  location: string | null
  years_experience: number | null
  salary_range: string | null
  education: string | null
  linkedin_url: string | null
  liepin_url: string | null
  phone: string | null
  email: string | null
  experience_summary: string | null
  raw_structured_data: Record<string, unknown> | null
  confidence_score: number | null
  source_platform: string | null
  created_at: string
  updated_at: string
}

export interface CandidateUpdate {
  full_name?: string
  current_title?: string | null
  current_company?: string | null
  location?: string | null
  years_experience?: number | null
  salary_range?: string | null
  education?: string | null
  linkedin_url?: string | null
  liepin_url?: string | null
  phone?: string | null
  email?: string | null
  experience_summary?: string | null
}

export interface CandidateSearchRequest {
  query?: string | null
  location?: string | null
  min_years_experience?: number | null
  max_years_experience?: number | null
  current_company?: string | null
  source_platform?: string | null
  schools?: string[] | null
  limit?: number
  offset?: number
  exclude_query?: string | null
  exclude_companies?: string[] | null
  exclude_locations?: string[] | null
}

export interface CandidateSearchResult {
  candidate: CandidateResponse
  sql_matched: boolean
  fts_matched?: boolean
  vector_score: number | null
  combined_score: number
}

export interface QueryRewriteFilters {
  location: string | null
  min_years_experience: number | null
  max_years_experience: number | null
  current_company: string | null
  schools: string[]
}

export interface QueryRewriteExclusions {
  exclude_companies: string[]
  exclude_locations: string[]
  exclude_query: string | null
}

export interface QueryRewriteResponse {
  raw_query: string
  semantic_query: string
  filters: QueryRewriteFilters
  exclusions: QueryRewriteExclusions
  used_llm: boolean
  skip_reason: string | null
}
