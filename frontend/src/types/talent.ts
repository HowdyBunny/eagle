import type { CandidateResponse } from './candidate'

export interface ParsedCandidateData {
  full_name: string | null
  current_title: string | null
  current_company: string | null
  location: string | null
  years_experience: number | null
  salary_range: string | null
  education: string | null
  phone: string | null
  email: string | null
  experience_summary: string | null
}

export interface DuplicateConflict {
  existing_candidate: CandidateResponse
  match_reason: 'phone' | 'email' | 'name_company'
}

export interface ParseResult {
  parsed_data: ParsedCandidateData
  conflicts: DuplicateConflict[]
}

export interface ParseResponse {
  results: ParseResult[]
  error: string | null
}

export interface ConfirmCandidateItem {
  parsed_data: ParsedCandidateData
  action: 'create' | 'skip' | 'overwrite'
  existing_id?: string
  source_platform: string
}

export interface ConfirmImportRequest {
  candidates: ConfirmCandidateItem[]
}

export interface ConfirmImportResponse {
  created: number
  updated: number
  skipped: number
}
