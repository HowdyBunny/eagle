export type ProjectStatus = 'active' | 'completed' | 'archived'

export interface ProjectCreate {
  client_name: string
  project_name: string
  jd_raw?: string | null
  requirement_profile?: Record<string, unknown> | null
}

export interface ProjectUpdate {
  client_name?: string | null
  project_name?: string | null
  jd_raw?: string | null
  requirement_profile?: Record<string, unknown> | null
  status?: ProjectStatus | null
}

export interface ProjectResponse {
  id: string
  client_name: string
  project_name: string
  jd_raw: string | null
  requirement_profile: Record<string, unknown> | null
  status: ProjectStatus
  folder_path: string | null
  created_at: string
  updated_at: string
}
