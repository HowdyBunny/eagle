// Candidate data extracted from DOM, matching backend CandidateCreate schema
export interface CandidateData {
  full_name: string;
  current_title?: string;
  current_company?: string;
  location?: string;
  years_experience?: number;
  education?: string;
  experience_summary?: string;
  linkedin_url?: string;
  liepin_url?: string;
  source_platform: 'linkedin' | 'liepin';
  raw_structured_data: Record<string, unknown>;
}

// Project from backend ProjectResponse
export interface Project {
  id: string;
  client_name: string;
  project_name: string;
  status: 'active' | 'completed' | 'archived';
  mode: 'precise' | 'explore';
  created_at: string;
  updated_at: string;
}

// Candidate from backend CandidateResponse
export interface Candidate {
  id: string;
  full_name: string;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  confidence_score: number | null;
  source_platform: string | null;
  created_at: string;
}

// Evaluation status from backend EvaluationStatusResponse
export interface EvaluationStatus {
  project_id: string;
  candidate_id: string;
  is_complete: boolean;
  status: 'pending' | 'recommended' | 'eliminated' | 'interviewed' | 'failed';
  error_message?: string | null;
  match_score: number | null;
  evaluated_at: string | null;
  poll_interval_seconds: number;
}

// Message passing types (content script <-> background)
export type MessageRequest =
  | { type: 'FETCH_PROJECTS' }
  | { type: 'SUBMIT_CANDIDATE'; payload: CandidateData }
  | { type: 'TRIGGER_EVALUATION'; payload: { projectId: string; candidateId: string } }
  | { type: 'POLL_EVALUATION'; payload: { projectId: string; candidateId: string } }
  | { type: 'TEST_CONNECTION' };

export type MessageResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };
