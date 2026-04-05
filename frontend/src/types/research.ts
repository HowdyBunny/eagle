import type { OntologyResponse } from './ontology'

export interface ResearchTriggerRequest {
  topic: string
  additional_context?: string | null
}

export interface ResearchResponse {
  id: string
  project_id: string
  ontology_id: string
  report_file_path: string | null
  created_at: string
  ontology: OntologyResponse | null
}
